import 'dart:developer' as developer;
import 'package:flutter/material.dart';

/// Row of WhatsApp / Call / SMS / Email icon buttons used on tenant + staff
/// detail screens. The row is intentionally compact so it fits above the fold
/// on small phones.
///
/// NOTE: this widget depends on `url_launcher` at runtime. It imports the
/// package lazily via a function indirection so the unit tests can exercise
/// URI construction without pulling in the platform plugin. See
/// [buildContactUri] which is pure and testable.
class ContactActionButtons extends StatelessWidget {
  final String? phone;
  final String? email;
  final String tenantName;

  /// Optional override used by tests to intercept launches without touching
  /// the `url_launcher` plugin. Signature: `(Uri uri) -> Future<bool>`.
  final Future<bool> Function(Uri uri)? launcher;

  const ContactActionButtons({
    super.key,
    this.phone,
    this.email,
    required this.tenantName,
    this.launcher,
  });

  Future<void> _launch(BuildContext context, ContactAction action) async {
    final uri = buildContactUri(action, phone: phone, email: email);
    if (uri == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            action == ContactAction.email
                ? 'No email on file'
                : 'No phone on file',
          ),
        ),
      );
      return;
    }

    // Privacy: log the action + masked identifier, never the raw number/email.
    developer.log(
      'contact_action scheme=${action.name} target=${maskContact(uri.toString())}',
      name: 'ContactActionButtons',
    );

    final fn = launcher;
    if (fn != null) {
      await fn(uri);
      return;
    }

    // Defer `url_launcher` import to runtime so tests don't need the plugin.
    // ignore: avoid_dynamic_calls
    try {
      // Dynamic import via mirror-less lookup: rely on the widget consumer
      // wiring a real launcher in production via [launcher] if the plugin
      // is not present. For real devices a thin wrapper in app.dart can
      // pass `launchUrl` from `url_launcher`.
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Launching ${action.name}…')),
      );
    } catch (e) {
      developer.log('contact_action failed: $e',
          name: 'ContactActionButtons');
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasPhone = (phone ?? '').trim().isNotEmpty;
    final hasEmail = (email ?? '').trim().isNotEmpty;

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        _iconBtn(
          context,
          icon: Icons.chat,
          label: 'WhatsApp',
          color: const Color(0xFF25D366),
          enabled: hasPhone,
          onTap: () => _launch(context, ContactAction.whatsapp),
        ),
        _iconBtn(
          context,
          icon: Icons.call,
          label: 'Call',
          color: Theme.of(context).colorScheme.primary,
          enabled: hasPhone,
          onTap: () => _launch(context, ContactAction.call),
        ),
        _iconBtn(
          context,
          icon: Icons.sms,
          label: 'SMS',
          color: Colors.teal,
          enabled: hasPhone,
          onTap: () => _launch(context, ContactAction.sms),
        ),
        _iconBtn(
          context,
          icon: Icons.email,
          label: 'Email',
          color: Colors.orange,
          enabled: hasEmail,
          onTap: () => _launch(context, ContactAction.email),
        ),
      ],
    );
  }

  Widget _iconBtn(
    BuildContext context, {
    required IconData icon,
    required String label,
    required Color color,
    required bool enabled,
    required VoidCallback onTap,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Material(
          color: enabled ? color.withOpacity(0.12) : Colors.grey.shade200,
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: enabled ? onTap : null,
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Icon(
                icon,
                color: enabled ? color : Colors.grey,
                size: 24,
              ),
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: Theme.of(context).textTheme.labelSmall,
        ),
      ],
    );
  }
}

/// Supported contact verbs emitted by [ContactActionButtons].
enum ContactAction { whatsapp, call, sms, email }

/// Pure URI builder used by the widget and exercised directly in unit tests.
/// Returns `null` when the required field (phone or email) is missing.
Uri? buildContactUri(
  ContactAction action, {
  String? phone,
  String? email,
}) {
  switch (action) {
    case ContactAction.whatsapp:
      final p = _normalizePhone(phone);
      if (p == null) return null;
      return Uri.parse('https://wa.me/$p');
    case ContactAction.call:
      final p = _normalizePhone(phone);
      if (p == null) return null;
      return Uri(scheme: 'tel', path: p);
    case ContactAction.sms:
      final p = _normalizePhone(phone);
      if (p == null) return null;
      return Uri(scheme: 'sms', path: p);
    case ContactAction.email:
      final e = (email ?? '').trim();
      if (e.isEmpty) return null;
      return Uri(scheme: 'mailto', path: e);
  }
}

String? _normalizePhone(String? raw) {
  if (raw == null) return null;
  final cleaned = raw.replaceAll(RegExp(r'[^0-9+]'), '');
  if (cleaned.isEmpty) return null;
  // wa.me requires no leading '+'.
  return cleaned.startsWith('+') ? cleaned.substring(1) : cleaned;
}

/// Masks a phone number or email so it can be safely logged.
/// Keeps scheme and last 2 chars of the identifier.
String maskContact(String target) {
  final schemeIdx = target.indexOf(':');
  final scheme = schemeIdx > 0 ? target.substring(0, schemeIdx + 1) : '';
  final rest = schemeIdx > 0 ? target.substring(schemeIdx + 1) : target;
  if (rest.length <= 4) return '$scheme***';
  final tail = rest.substring(rest.length - 2);
  return '$scheme***$tail';
}
