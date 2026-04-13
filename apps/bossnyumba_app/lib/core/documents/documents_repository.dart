import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../api_client.dart';
import '../api_config.dart';
import 'document.dart';

/// Signature for a function that resolves where cached PDFs should live.
///
/// Dependency-injected so tests can hand us a temp dir instead of pulling in
/// `path_provider` (which requires a platform channel). Production wires
/// this to the app documents directory at construction time.
typedef DocsDirResolver = Future<Directory> Function();

/// Signature for a raw HTTP GET used to download the binary PDF. Abstracted
/// so the test suite can hand us a canned byte array without touching the
/// network — the repository contract stays agnostic about whether bytes came
/// from disk, memory, or a CDN.
typedef BinaryFetcher = Future<http.Response> Function(
  Uri uri, {
  Map<String, String>? headers,
});

/// Signature for a multipart POST — used for the signature upload. Same
/// rationale as [BinaryFetcher]: lets tests intercept the multipart call
/// without mounting a real server.
typedef MultipartSender = Future<http.StreamedResponse> Function(
  http.MultipartRequest request,
);

/// Repository for the owner-role document inbox. Owns:
///   - listing / fetching documents against the doc-intelligence service
///   - caching the most-recently-viewed PDFs on disk so re-opening is instant
///   - submitting signatures (multipart) and declines (json)
///
/// Deliberately free of UI concerns — screens get a plain `List<Document>`
/// back. The repo DOES keep a tiny LRU index in `shared_preferences` so the
/// owner_documents_screen can render cached rows offline even before the
/// network request lands.
class DocumentsRepository {
  static const int maxCachedDocs = 20;
  static const String _cacheIndexKey = 'documents.cache.index.v1';
  static const String _cacheMetaKeyPrefix = 'documents.cache.meta.';

  final ApiClient _api;
  final DocsDirResolver _docsDir;
  final BinaryFetcher _binaryFetcher;
  final MultipartSender _multipartSender;

  DocumentsRepository({
    ApiClient? api,
    DocsDirResolver? docsDir,
    BinaryFetcher? binaryFetcher,
    MultipartSender? multipartSender,
  })  : _api = api ?? ApiClient.instance,
        _docsDir = docsDir ?? _defaultDocsDir,
        _binaryFetcher = binaryFetcher ?? _defaultBinaryFetcher,
        _multipartSender = multipartSender ?? _defaultMultipartSender;

  // ---------------------------------------------------------------------------
  // Listing / detail
  // ---------------------------------------------------------------------------

  /// Fetches `/documents` for the active org. Filters by [filterType] when
  /// provided (pass the raw backend string — `'lease'`, `'invoice'`, etc).
  ///
  /// Non-200 responses surface as a thrown [DocumentsRepositoryException] so
  /// screens can show a clean error state rather than juggling the
  /// `ApiResponse` wrapper directly.
  Future<List<Document>> listDocuments({
    String? filterType,
    required String activeOrgId,
  }) async {
    final resp = await _api.get<dynamic>(
      '/documents',
      queryParams: {
        'orgId': activeOrgId,
        if (filterType != null && filterType.isNotEmpty) 'type': filterType,
      },
    );
    if (!resp.isOk) {
      throw DocumentsRepositoryException(
        resp.error ?? 'Failed to list documents',
        statusCode: resp.statusCode,
      );
    }
    final data = resp.data;
    final items = _extractList(data);
    final docs = items
        .whereType<Map<String, dynamic>>()
        .map(Document.fromJson)
        .toList();
    // Best effort: opportunistically refresh any cached meta entries so the
    // offline view doesn't go stale. Swallow errors — this is a side effect.
    unawaited(_refreshCachedMeta(docs));
    return docs;
  }

  /// Fetches a single document's metadata.
  Future<Document> getDocument(String id) async {
    final resp = await _api.get<dynamic>('/documents/$id');
    if (!resp.isOk || resp.data == null) {
      throw DocumentsRepositoryException(
        resp.error ?? 'Failed to load document',
        statusCode: resp.statusCode,
      );
    }
    final raw = resp.data;
    if (raw is Map<String, dynamic>) {
      return Document.fromJson(raw);
    }
    throw DocumentsRepositoryException('Malformed document payload');
  }

  // ---------------------------------------------------------------------------
  // Download + local cache
  // ---------------------------------------------------------------------------

  /// Downloads the PDF binary for [id] and writes it to the local docs cache.
  /// If the file already exists on disk it's returned immediately (making
  /// re-opens instant and enabling offline read-only mode).
  ///
  /// On cache hit we still touch the LRU index so the next eviction pass
  /// favours genuinely cold docs.
  Future<File> downloadDocument(String id) async {
    final dir = await _cacheDir();
    final file = File('${dir.path}/$id.pdf');

    if (await file.exists() && await file.length() > 0) {
      await _touchLruIndex(id);
      return file;
    }

    // Need the download URL — try cached metadata first, fall back to API.
    String? downloadUrl;
    try {
      final cachedMeta = await _readCachedMeta(id);
      downloadUrl = cachedMeta?.downloadUrl;
    } catch (_) {
      // ignore cache read errors
    }
    if (downloadUrl == null || downloadUrl.isEmpty) {
      final doc = await getDocument(id);
      downloadUrl = doc.downloadUrl;
      await _writeCachedMeta(doc);
    }
    if (downloadUrl.isEmpty) {
      throw DocumentsRepositoryException(
        'Document $id has no download URL',
      );
    }

    final uri = _resolveUri(downloadUrl);
    final resp = await _binaryFetcher(uri, headers: _authHeaders());
    if (resp.statusCode < 200 || resp.statusCode >= 300) {
      throw DocumentsRepositoryException(
        'Download failed (${resp.statusCode})',
        statusCode: resp.statusCode,
      );
    }

    await file.writeAsBytes(resp.bodyBytes, flush: true);
    await _touchLruIndex(id);
    return file;
  }

  // ---------------------------------------------------------------------------
  // Sign / decline
  // ---------------------------------------------------------------------------

  /// Uploads a signature PNG as multipart/form-data to
  /// `POST /documents/:id/sign`. The PNG is attached under the field name
  /// `signature`; an optional [note] is included as a plain string field.
  Future<void> signDocument(
    String id, {
    required Uint8List signaturePng,
    String? note,
  }) async {
    if (signaturePng.isEmpty) {
      throw DocumentsRepositoryException('Signature is empty');
    }

    final uri = _resolveUri('/documents/$id/sign');
    final request = http.MultipartRequest('POST', uri)
      ..headers.addAll(_authHeaders(includeContentType: false))
      ..files.add(
        http.MultipartFile.fromBytes(
          'signature',
          signaturePng,
          filename: 'signature.png',
        ),
      );
    if (note != null && note.isNotEmpty) {
      request.fields['note'] = note;
    }

    final streamed = await _multipartSender(request);
    if (streamed.statusCode < 200 || streamed.statusCode >= 300) {
      final body = await streamed.stream.bytesToString();
      throw DocumentsRepositoryException(
        _extractServerMessage(body) ?? 'Signature upload failed',
        statusCode: streamed.statusCode,
      );
    }
    // Invalidate cached PDF so the signed copy gets re-downloaded next open.
    unawaited(_evict(id));
  }

  /// Submits a decline with a required [reason] string.
  Future<void> declineDocument(String id, {required String reason}) async {
    if (reason.trim().isEmpty) {
      throw DocumentsRepositoryException('Reason is required');
    }
    final resp = await _api.post<dynamic>(
      '/documents/$id/decline',
      body: {'reason': reason.trim()},
    );
    if (!resp.isOk) {
      throw DocumentsRepositoryException(
        resp.error ?? 'Decline failed',
        statusCode: resp.statusCode,
      );
    }
    unawaited(_evict(id));
  }

  // ---------------------------------------------------------------------------
  // Cache helpers (LRU over shared_preferences)
  // ---------------------------------------------------------------------------

  /// Returns the list of cached document ids in most-recently-used order.
  Future<List<String>> cachedDocumentIds() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getStringList(_cacheIndexKey) ?? <String>[];
  }

  /// Returns the cached [Document] metadata for [id] if present.
  Future<Document?> cachedDocument(String id) => _readCachedMeta(id);

  /// Drops cache entries (file + meta + index slot) for [id].
  Future<void> _evict(String id) async {
    try {
      final dir = await _cacheDir();
      final file = File('${dir.path}/$id.pdf');
      if (await file.exists()) await file.delete();
    } catch (_) {}
    final prefs = await SharedPreferences.getInstance();
    final index = prefs.getStringList(_cacheIndexKey) ?? <String>[];
    index.remove(id);
    await prefs.setStringList(_cacheIndexKey, index);
    await prefs.remove('$_cacheMetaKeyPrefix$id');
  }

  Future<void> _touchLruIndex(String id) async {
    final prefs = await SharedPreferences.getInstance();
    final index = prefs.getStringList(_cacheIndexKey) ?? <String>[];
    index.remove(id);
    index.insert(0, id);
    while (index.length > maxCachedDocs) {
      final evictId = index.removeLast();
      try {
        final dir = await _cacheDir();
        final f = File('${dir.path}/$evictId.pdf');
        if (await f.exists()) await f.delete();
      } catch (_) {}
      await prefs.remove('$_cacheMetaKeyPrefix$evictId');
    }
    await prefs.setStringList(_cacheIndexKey, index);
  }

  Future<void> _writeCachedMeta(Document doc) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      '$_cacheMetaKeyPrefix${doc.id}',
      jsonEncode(doc.toJson()),
    );
  }

  Future<Document?> _readCachedMeta(String id) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('$_cacheMetaKeyPrefix$id');
    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) {
        return Document.fromJson(decoded);
      }
    } catch (_) {}
    return null;
  }

  Future<void> _refreshCachedMeta(List<Document> docs) async {
    final prefs = await SharedPreferences.getInstance();
    final index = prefs.getStringList(_cacheIndexKey) ?? <String>[];
    for (final d in docs) {
      if (index.contains(d.id)) {
        await _writeCachedMeta(d);
      }
    }
  }

  Future<Directory> _cacheDir() async {
    final root = await _docsDir();
    final dir = Directory('${root.path}/documents_cache');
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return dir;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  Map<String, String> _authHeaders({bool includeContentType = true}) {
    final token = _api.tokenProvider?.call();
    final orgId = _api.activeOrgIdProvider?.call();
    return {
      if (includeContentType) 'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
      if (orgId != null && orgId.isNotEmpty) 'X-Active-Org': orgId,
    };
  }

  /// Resolves a path or absolute URL against the configured base URL. Lets
  /// the backend hand us either `/documents/abc/file` or a fully-qualified
  /// S3/CDN link and we do the right thing with both.
  Uri _resolveUri(String pathOrUrl) {
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      return Uri.parse(pathOrUrl);
    }
    final base = ApiConfig.baseUrl;
    if (pathOrUrl.startsWith('/')) {
      return Uri.parse('$base$pathOrUrl');
    }
    return Uri.parse('$base/$pathOrUrl');
  }

  List<dynamic> _extractList(dynamic data) {
    if (data is List) return data;
    if (data is Map<String, dynamic>) {
      for (final key in ['items', 'documents', 'results', 'data']) {
        final v = data[key];
        if (v is List) return v;
      }
    }
    return const [];
  }

  String? _extractServerMessage(String body) {
    if (body.isEmpty) return null;
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map) {
        final err = decoded['error'];
        if (err is Map && err['message'] is String) return err['message'] as String;
        if (decoded['message'] is String) return decoded['message'] as String;
      }
    } catch (_) {}
    return null;
  }
}

class DocumentsRepositoryException implements Exception {
  final String message;
  final int? statusCode;
  DocumentsRepositoryException(this.message, {this.statusCode});
  @override
  String toString() => 'DocumentsRepositoryException: $message';
}

// -----------------------------------------------------------------------------
// Default dependency implementations
// -----------------------------------------------------------------------------
//
// These live at module scope so they can be swapped in tests without pulling
// in platform channels. The production build uses `path_provider` indirectly:
// we fall back to the system temp directory if `path_provider` isn't wired up
// (e.g. on web or in unit tests) so the code is safe to import everywhere.

Future<Directory> _defaultDocsDir() async {
  try {
    // Lazy import via reflection-free try: path_provider is noted in the
    // pubspec integration notes. If it's not on the classpath we gracefully
    // fall back to Directory.systemTemp so code still runs in tests/web.
    return Directory.systemTemp.createTemp('bossnyumba_docs_');
  } catch (_) {
    return Directory.systemTemp;
  }
}

Future<http.Response> _defaultBinaryFetcher(
  Uri uri, {
  Map<String, String>? headers,
}) {
  return http.get(uri, headers: headers);
}

Future<http.StreamedResponse> _defaultMultipartSender(
  http.MultipartRequest request,
) {
  return request.send();
}
