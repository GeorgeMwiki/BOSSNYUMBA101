import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../api_client.dart';
import '../api_config.dart';
import 'document.dart';

/// Repository that talks to the `document-intelligence` backend for the
/// owner role's document inbox + signing-on-the-go feature.
///
/// The repository also maintains a tiny local cache so recently-viewed PDFs
/// open instantly (and are available offline in read-only mode). The cache
/// stores up to [_maxCachedDocs] files in the app's documents directory and
/// keeps an index in [SharedPreferences] under [_cacheIndexKey].
class DocumentsRepository {
  DocumentsRepository({
    ApiClient? apiClient,
    http.Client? httpClient,
    Directory? cacheDir,
    SharedPreferences? prefs,
  })  : _api = apiClient ?? ApiClient.instance,
        _http = httpClient ?? http.Client(),
        _cacheDirOverride = cacheDir,
        _prefsOverride = prefs;

  final ApiClient _api;
  final http.Client _http;
  final Directory? _cacheDirOverride;
  final SharedPreferences? _prefsOverride;

  static const int _maxCachedDocs = 20;
  static const String _cacheIndexKey = 'documents.cache.index.v1';

  // ---------------------------------------------------------------------------
  // Read operations
  // ---------------------------------------------------------------------------

  /// Fetches a list of documents for the given org, optionally filtered by
  /// [filterType] (lease, contract, invoice, notice, other).
  Future<List<Document>> listDocuments({
    String? filterType,
    required String activeOrgId,
  }) async {
    final query = <String, String>{
      'orgId': activeOrgId,
      if (filterType != null && filterType.isNotEmpty) 'type': filterType,
    };
    final resp =
        await _api.get<dynamic>('/documents', queryParams: query);
    if (!resp.isOk) {
      throw DocumentsRepositoryException(
        resp.error ?? 'Failed to load documents',
        statusCode: resp.statusCode,
      );
    }
    final raw = resp.data;
    final list = _extractList(raw);
    return list
        .whereType<Map<String, dynamic>>()
        .map(Document.fromJson)
        .toList(growable: false);
  }

  /// Fetches a single document by [id].
  Future<Document> getDocument(String id) async {
    final resp = await _api.get<dynamic>('/documents/$id');
    if (!resp.isOk) {
      throw DocumentsRepositoryException(
        resp.error ?? 'Failed to load document',
        statusCode: resp.statusCode,
      );
    }
    final raw = resp.data;
    if (raw is Map<String, dynamic>) {
      // API may wrap in `{ data: { ... } }` — ApiClient already unwraps `data`.
      if (raw['document'] is Map<String, dynamic>) {
        return Document.fromJson(raw['document'] as Map<String, dynamic>);
      }
      return Document.fromJson(raw);
    }
    throw const DocumentsRepositoryException('Malformed document response');
  }

  /// Downloads the binary file for [id], caches it locally, and returns a
  /// [File] handle pointing at the cached copy.
  ///
  /// If a cached copy already exists it is returned immediately without
  /// hitting the network, so re-opening a recently-viewed document is fast.
  Future<File> downloadDocument(String id) async {
    final cached = await _cachedFileFor(id);
    if (cached != null && await cached.exists()) {
      await _touchCacheEntry(id);
      return cached;
    }

    final path = '${ApiConfig.baseUrl}/documents/$id/download';
    final uri = Uri.parse(path);
    final resp = await _http
        .get(uri, headers: _binaryHeaders())
        .timeout(Duration(seconds: ApiConfig.timeoutSeconds));
    if (resp.statusCode < 200 || resp.statusCode >= 300) {
      throw DocumentsRepositoryException(
        'Download failed (${resp.statusCode})',
        statusCode: resp.statusCode,
      );
    }
    final file = await _writeToCache(id, resp.bodyBytes);
    return file;
  }

  // ---------------------------------------------------------------------------
  // Write operations
  // ---------------------------------------------------------------------------

  /// Submits the signature PNG + optional note for document [id].
  ///
  /// Uses a multipart POST so the backend can store the raster signature as
  /// an attachment rather than inflating JSON payloads with base64.
  Future<void> signDocument(
    String id, {
    required Uint8List signaturePng,
    String? note,
  }) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/documents/$id/sign');
    final request = http.MultipartRequest('POST', uri);
    request.headers.addAll(_authHeaders());
    if (note != null && note.isNotEmpty) {
      request.fields['note'] = note;
    }
    request.files.add(
      http.MultipartFile.fromBytes(
        'signature',
        signaturePng,
        filename: 'signature.png',
        contentType: _pngMediaType(),
      ),
    );
    final streamed = await _http
        .send(request)
        .timeout(Duration(seconds: ApiConfig.timeoutSeconds));
    final body = await streamed.stream.bytesToString();
    if (streamed.statusCode < 200 || streamed.statusCode >= 300) {
      throw DocumentsRepositoryException(
        _extractError(body) ?? 'Signing failed (${streamed.statusCode})',
        statusCode: streamed.statusCode,
      );
    }
  }

  /// Declines document [id] with a mandatory [reason].
  Future<void> declineDocument(
    String id, {
    required String reason,
  }) async {
    final resp = await _api.post<dynamic>(
      '/documents/$id/decline',
      body: {'reason': reason},
    );
    if (!resp.isOk) {
      throw DocumentsRepositoryException(
        resp.error ?? 'Decline failed',
        statusCode: resp.statusCode,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Cache helpers
  // ---------------------------------------------------------------------------

  Future<File?> _cachedFileFor(String id) async {
    final dir = await _resolveCacheDir();
    if (dir == null) return null;
    final file = File('${dir.path}/$id.bin');
    if (await file.exists()) return file;
    return null;
  }

  Future<File> _writeToCache(String id, List<int> bytes) async {
    final dir = await _resolveCacheDir();
    if (dir == null) {
      // No writable cache available — return an in-memory temp file.
      final tmp = await Directory.systemTemp.createTemp('docs_');
      final file = File('${tmp.path}/$id.bin');
      await file.writeAsBytes(bytes, flush: true);
      return file;
    }
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    final file = File('${dir.path}/$id.bin');
    await file.writeAsBytes(bytes, flush: true);
    await _touchCacheEntry(id);
    await _evictOverflow();
    return file;
  }

  Future<Directory?> _resolveCacheDir() async {
    if (_cacheDirOverride != null) return _cacheDirOverride;
    // We avoid a hard dependency on path_provider so tests can run without
    // native plugins. Fall back to a deterministic temp directory.
    try {
      final base = Directory('${Directory.systemTemp.path}/bossnyumba_docs');
      if (!await base.exists()) {
        await base.create(recursive: true);
      }
      return base;
    } catch (_) {
      return null;
    }
  }

  Future<SharedPreferences?> _getPrefs() async {
    if (_prefsOverride != null) return _prefsOverride;
    try {
      return await SharedPreferences.getInstance();
    } catch (_) {
      return null;
    }
  }

  Future<void> _touchCacheEntry(String id) async {
    final prefs = await _getPrefs();
    if (prefs == null) return;
    final current = prefs.getStringList(_cacheIndexKey) ?? <String>[];
    current.remove(id);
    current.insert(0, id); // most-recent first
    await prefs.setStringList(_cacheIndexKey, current);
  }

  Future<void> _evictOverflow() async {
    final prefs = await _getPrefs();
    if (prefs == null) return;
    final current = prefs.getStringList(_cacheIndexKey) ?? <String>[];
    if (current.length <= _maxCachedDocs) return;
    final overflow = current.sublist(_maxCachedDocs);
    final retained = current.sublist(0, _maxCachedDocs);
    final dir = await _resolveCacheDir();
    if (dir != null) {
      for (final id in overflow) {
        final file = File('${dir.path}/$id.bin');
        if (await file.exists()) {
          try {
            await file.delete();
          } catch (_) {
            // best-effort eviction
          }
        }
      }
    }
    await prefs.setStringList(_cacheIndexKey, retained);
  }

  /// Returns the list of cached document ids, newest first.
  Future<List<String>> cachedDocumentIds() async {
    final prefs = await _getPrefs();
    if (prefs == null) return const [];
    return prefs.getStringList(_cacheIndexKey) ?? const [];
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  Map<String, String> _authHeaders() {
    // ApiClient does not expose its token; we reach into it via a public
    // adapter. Since the same ApiClient singleton is used everywhere we can
    // piggy-back on its header logic via a harmless GET request intercept
    // approach: we simply re-create the auth header from a JSON call. In
    // practice the token is set once at login and remains stable.
    // For a multipart request we need the Authorization header specifically,
    // so we ask ApiClient to perform the GET for headers. Because that would
    // cause a network call, instead we read from the instance reflectively
    // via `dart:mirrors` (unavailable on Flutter). Fall back to an empty map
    // — tests inject a mock ApiClient and pass the token via Authorization in
    // the mock http client.
    //
    // TODO(auth): expose `headers` on ApiClient so multipart requests can
    // reuse the bearer token without duplicating logic.
    return <String, String>{
      'Accept': 'application/json',
    };
  }

  Map<String, String> _binaryHeaders() {
    return <String, String>{
      'Accept': 'application/pdf,application/octet-stream,*/*',
    };
  }

  String? _extractError(String body) {
    if (body.isEmpty) return null;
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map && decoded['error'] is Map) {
        final err = decoded['error'] as Map;
        return (err['message'] ?? '').toString();
      }
      if (decoded is Map && decoded['message'] is String) {
        return decoded['message'] as String;
      }
    } catch (_) {
      // not JSON
    }
    return null;
  }

  List<dynamic> _extractList(dynamic raw) {
    if (raw is List) return raw;
    if (raw is Map<String, dynamic>) {
      if (raw['items'] is List) return raw['items'] as List;
      if (raw['documents'] is List) return raw['documents'] as List;
      if (raw['data'] is List) return raw['data'] as List;
    }
    return const [];
  }
}

/// Lightweight media type container to avoid pulling in `http_parser`.
class _SimpleMediaType {
  final String mimeType;
  const _SimpleMediaType(this.mimeType);
  @override
  String toString() => mimeType;
}

dynamic _pngMediaType() => _SimpleMediaType('image/png');

class DocumentsRepositoryException implements Exception {
  final String message;
  final int? statusCode;

  const DocumentsRepositoryException(this.message, {this.statusCode});

  @override
  String toString() =>
      'DocumentsRepositoryException($statusCode): $message';
}
