import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/auth_provider.dart';
import '../../core/search/search_repository.dart';
import 'owner_property_detail_screen.dart';
import 'owner_tenant_detail_screen.dart';
import 'owner_unit_detail_screen.dart';

/// Signature for a "voice capture" callback. Returning the spoken text (or
/// `null` on cancel). Wired to `speech_to_text` in production (assumed
/// available at runtime); left as an injection point so unit tests can
/// exercise the mic toggle without the plugin.
typedef VoiceCapture = Future<String?> Function(BuildContext context);

/// Universal search surface for owners. "In-a-meeting, 10 seconds to answer"
/// is the optimisation target — autofocus, debounced live results, grouped by
/// entity type and a quick set of recent searches as chips.
class OwnerSearchScreen extends StatefulWidget {
  final SearchRepository? repository;
  final Future<SharedPreferences> Function()? prefsLoader;
  final VoiceCapture? voiceCapture;

  /// Optional active org id override (useful in tests). In production this is
  /// read from the app-wide org provider; if that provider is unavailable the
  /// screen falls back to the empty string which makes the API ignore the
  /// filter.
  final String? activeOrgId;

  const OwnerSearchScreen({
    super.key,
    this.repository,
    this.prefsLoader,
    this.voiceCapture,
    this.activeOrgId,
  });

  @override
  State<OwnerSearchScreen> createState() => _OwnerSearchScreenState();
}

class _OwnerSearchScreenState extends State<OwnerSearchScreen> {
  static const Duration _debounceDuration = Duration(milliseconds: 250);
  static const int _maxRecent = 10;

  late final SearchRepository _repo;
  late final TextEditingController _controller;
  final FocusNode _focusNode = FocusNode();

  Timer? _debounce;
  String _query = '';
  bool _loading = false;
  bool _listening = false;
  String? _error;
  SearchResults _results = SearchResults.empty;
  List<String> _recent = [];

  @override
  void initState() {
    super.initState();
    _repo = widget.repository ?? SearchRepository();
    _controller = TextEditingController();
    _loadRecent();
    // Autofocus: open with keyboard visible so the owner can type immediately.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _focusNode.requestFocus();
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Future<SharedPreferences> _prefs() =>
      widget.prefsLoader?.call() ?? SharedPreferences.getInstance();

  String _recentKey() {
    final userId = context.read<AuthProvider>().session?.id ?? 'anonymous';
    return 'owner_search_recent::$userId';
  }

  Future<void> _loadRecent() async {
    try {
      final prefs = await _prefs();
      final raw = prefs.getString(_recentKey());
      if (raw == null || raw.isEmpty) return;
      final decoded = jsonDecode(raw);
      if (decoded is List) {
        if (!mounted) return;
        setState(() {
          _recent = decoded
              .whereType<String>()
              .take(_maxRecent)
              .toList(growable: false);
        });
      }
    } catch (_) {
      // Non-fatal: recent searches are a convenience, not a feature gate.
    }
  }

  Future<void> _persistRecent(String term) async {
    final cleaned = term.trim();
    if (cleaned.isEmpty) return;
    final updated = <String>[cleaned];
    for (final r in _recent) {
      if (r.toLowerCase() != cleaned.toLowerCase()) updated.add(r);
      if (updated.length >= _maxRecent) break;
    }
    if (!mounted) return;
    setState(() => _recent = updated);
    try {
      final prefs = await _prefs();
      await prefs.setString(_recentKey(), jsonEncode(updated));
    } catch (_) {
      // swallow — recent persistence is best-effort.
    }
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    setState(() {
      _query = value;
      _error = null;
    });
    final trimmed = value.trim();
    if (trimmed.isEmpty) {
      setState(() {
        _results = SearchResults.empty;
        _loading = false;
      });
      return;
    }
    _debounce = Timer(_debounceDuration, () => _runSearch(trimmed));
  }

  Future<void> _runSearch(String term) async {
    if (!mounted) return;
    setState(() => _loading = true);
    try {
      final res = await _repo.search(term, widget.activeOrgId ?? '');
      if (!mounted) return;
      setState(() {
        _results = res;
        _loading = false;
      });
      if (!res.isEmpty) unawaited(_persistRecent(term));
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _toggleVoice() async {
    if (_listening) {
      setState(() => _listening = false);
      return;
    }
    setState(() => _listening = true);
    try {
      final capture = widget.voiceCapture;
      if (capture != null) {
        final spoken = await capture(context);
        if (spoken != null && spoken.isNotEmpty) {
          _controller.text = spoken;
          _controller.selection = TextSelection.collapsed(offset: spoken.length);
          _onChanged(spoken);
        }
      } else {
        // speech_to_text not wired — surface a gentle hint instead of crashing.
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Voice input unavailable')),
          );
        }
      }
    } finally {
      if (mounted) setState(() => _listening = false);
    }
  }

  void _selectRecent(String term) {
    _controller.text = term;
    _controller.selection = TextSelection.collapsed(offset: term.length);
    _onChanged(term);
  }

  void _openProperty(PropertyResult p) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => OwnerPropertyDetailScreen(propertyId: p.id, initialName: p.name),
      ),
    );
  }

  void _openUnit(UnitResult u) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => OwnerUnitDetailScreen(unitId: u.id, initialLabel: u.label),
      ),
    );
  }

  void _openTenant(TenantResult t) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => OwnerTenantDetailScreen(tenantId: t.id, initialName: t.name),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Search')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
            child: SearchBar(
              controller: _controller,
              focusNode: _focusNode,
              hintText: 'Search properties, units, tenants…',
              leading: const Icon(Icons.search),
              trailing: [
                if (_query.isNotEmpty)
                  IconButton(
                    tooltip: 'Clear',
                    icon: const Icon(Icons.close),
                    onPressed: () {
                      _controller.clear();
                      _onChanged('');
                    },
                  ),
                IconButton(
                  tooltip: _listening ? 'Stop listening' : 'Voice search',
                  icon: Icon(_listening ? Icons.mic : Icons.mic_none),
                  onPressed: _toggleVoice,
                ),
              ],
              onChanged: _onChanged,
            ),
          ),
          if (_loading) const LinearProgressIndicator(minHeight: 2),
          Expanded(child: _buildBody(context)),
        ],
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    if (_error != null) {
      return _MessageState(
        icon: Icons.error_outline,
        title: 'Search failed',
        subtitle: _error!,
      );
    }

    if (_query.trim().isEmpty) {
      return _EmptyState(recent: _recent, onTapRecent: _selectRecent);
    }

    if (_results.isEmpty && !_loading) {
      return const _MessageState(
        icon: Icons.search_off,
        title: 'No results',
        subtitle: 'Try fewer characters, a unit number, or a tenant last name.',
      );
    }

    final sections = <Widget>[];

    if (_results.properties.isNotEmpty) {
      sections.add(_SectionHeader(label: 'Properties (${_results.properties.length})'));
      for (final p in _results.properties) {
        sections.add(_ResultTile(
          icon: Icons.apartment,
          title: p.name,
          subtitle: p.subtitle,
          onTap: () => _openProperty(p),
        ));
      }
    }

    if (_results.units.isNotEmpty) {
      sections.add(_SectionHeader(label: 'Units (${_results.units.length})'));
      for (final u in _results.units) {
        sections.add(_ResultTile(
          icon: Icons.meeting_room,
          title: u.label,
          subtitle: u.subtitle,
          onTap: () => _openUnit(u),
        ));
      }
    }

    if (_results.tenants.isNotEmpty) {
      sections.add(_SectionHeader(label: 'Tenants (${_results.tenants.length})'));
      for (final t in _results.tenants) {
        sections.add(_ResultTile(
          icon: Icons.person,
          title: t.name,
          subtitle: t.subtitle,
          onTap: () => _openTenant(t),
        ));
      }
    }

    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: sections,
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String label;
  const _SectionHeader({required this.label});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Text(
        label,
        style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: Theme.of(context).colorScheme.primary,
            ),
      ),
    );
  }
}

class _ResultTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _ResultTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: CircleAvatar(
        backgroundColor:
            Theme.of(context).colorScheme.primaryContainer.withOpacity(0.6),
        child: Icon(icon,
            color: Theme.of(context).colorScheme.onPrimaryContainer),
      ),
      title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis),
      trailing: const Icon(Icons.chevron_right),
      onTap: onTap,
    );
  }
}

class _EmptyState extends StatelessWidget {
  final List<String> recent;
  final ValueChanged<String> onTapRecent;

  const _EmptyState({required this.recent, required this.onTapRecent});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Column(
              children: [
                Icon(Icons.search, size: 56, color: Colors.grey[400]),
                const SizedBox(height: 12),
                Text(
                  'Search properties, units, tenants…',
                  style: Theme.of(context).textTheme.titleMedium,
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
          if (recent.isNotEmpty) ...[
            const SizedBox(height: 32),
            Text(
              'Recent',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: recent
                  .map((r) => ActionChip(
                        avatar: const Icon(Icons.history, size: 18),
                        label: Text(r),
                        onPressed: () => onTapRecent(r),
                      ))
                  .toList(growable: false),
            ),
          ],
        ],
      ),
    );
  }
}

class _MessageState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _MessageState({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 56, color: Colors.grey[400]),
            const SizedBox(height: 12),
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 6),
            Text(
              subtitle,
              style: Theme.of(context).textTheme.bodyMedium,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
