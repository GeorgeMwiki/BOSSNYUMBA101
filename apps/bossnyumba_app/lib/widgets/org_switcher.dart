import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/org_provider.dart';

/// Dropdown that lets the user swap between tenants/orgs they belong to.
///
/// Reads/writes [OrgProvider] which keeps the currently active id in sync with
/// [ApiClient] so every subsequent request picks up the `X-Active-Org` header.
///
/// The parallel auth refactor is expected to expose `availableOrgs` and
/// `activeOrgId` on [AuthProvider]. Once that lands, the integration point is
/// in [main.dart]/`auth_provider.dart` where we call
/// `OrgProvider.setAvailableOrgs(auth.availableOrgs, preferredActiveId: ...)`.
/// This widget intentionally talks to [OrgProvider] only, so it is resilient
/// to whichever concrete shape the auth branch ends up shipping.
class OrgSwitcher extends StatelessWidget {
  const OrgSwitcher({super.key, this.compact = true});

  /// When true renders as a compact app bar popup menu. When false renders a
  /// full-width [DropdownButtonFormField] suitable for drawers/settings.
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final org = context.watch<OrgProvider>();
    final orgs = org.availableOrgs;

    if (org.loading && orgs.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(horizontal: 12),
        child: SizedBox(
          width: 18,
          height: 18,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      );
    }

    if (orgs.isEmpty) return const SizedBox.shrink();

    if (orgs.length == 1) {
      final only = orgs.first;
      return compact
          ? _StaticOrgChip(label: only.name)
          : _StaticOrgChip(label: only.name, expanded: true);
    }

    final effective = orgs.any((o) => o.id == org.activeOrgId)
        ? org.activeOrgId
        : orgs.first.id;

    if (compact) {
      return PopupMenuButton<String>(
        key: const Key('org-switcher-menu'),
        tooltip: 'Switch organization',
        icon: const Icon(Icons.business_outlined),
        onSelected: (id) => context.read<OrgProvider>().setActiveOrg(id),
        itemBuilder: (context) => orgs
            .map(
              (o) => PopupMenuItem<String>(
                value: o.id,
                child: Row(
                  children: [
                    Icon(
                      o.id == effective
                          ? Icons.check_circle
                          : Icons.circle_outlined,
                      size: 18,
                      color: o.id == effective
                          ? Theme.of(context).colorScheme.primary
                          : Colors.grey,
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(o.name, overflow: TextOverflow.ellipsis),
                    ),
                  ],
                ),
              ),
            )
            .toList(),
      );
    }

    return DropdownButtonFormField<String>(
      key: const Key('org-switcher-dropdown'),
      value: effective,
      decoration: const InputDecoration(
        labelText: 'Organization',
        border: OutlineInputBorder(),
        prefixIcon: Icon(Icons.business_outlined),
      ),
      items: orgs
          .map(
            (o) => DropdownMenuItem<String>(
              value: o.id,
              child: Text(o.name, overflow: TextOverflow.ellipsis),
            ),
          )
          .toList(),
      onChanged: (id) {
        if (id != null) context.read<OrgProvider>().setActiveOrg(id);
      },
    );
  }
}

class _StaticOrgChip extends StatelessWidget {
  const _StaticOrgChip({required this.label, this.expanded = false});

  final String label;
  final bool expanded;

  @override
  Widget build(BuildContext context) {
    final chip = Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: Chip(
        avatar: const Icon(Icons.business_outlined, size: 16),
        label: Text(label, overflow: TextOverflow.ellipsis),
      ),
    );
    return expanded ? SizedBox(width: double.infinity, child: chip) : chip;
  }
}
