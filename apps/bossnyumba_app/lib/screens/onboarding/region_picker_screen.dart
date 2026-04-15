import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../router.dart' show onboardingListenable;

/// Shown once on first launch — lets the user pick the country/region that
/// configures currency, timezone and language defaults for the app. When
/// complete it sets the `bossnyumba:onboarded` flag and routes to /login.
class RegionPickerScreen extends StatefulWidget {
  const RegionPickerScreen({super.key});

  static const onboardedFlagKey = 'bossnyumba:onboarded';
  static const regionKey = 'bossnyumba:region';

  @override
  State<RegionPickerScreen> createState() => _RegionPickerScreenState();
}

class _RegionPickerScreenState extends State<RegionPickerScreen> {
  static const _regions = [
    ('KE', 'Kenya'),
    ('UG', 'Uganda'),
    ('TZ', 'Tanzania'),
    ('RW', 'Rwanda'),
    ('NG', 'Nigeria'),
    ('ZA', 'South Africa'),
  ];

  String? _selected;
  bool _saving = false;

  Future<void> _confirm() async {
    if (_selected == null || _saving) return;
    setState(() => _saving = true);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(RegionPickerScreen.regionKey, _selected!);
    await prefs.setBool(RegionPickerScreen.onboardedFlagKey, true);
    // Notify the router that onboarding is complete so redirect re-runs.
    await onboardingListenable.refresh();
    if (!mounted) return;
    context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Choose your region')),
      body: SafeArea(
        child: Column(
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                'Pick the country where you manage properties. This sets your '
                'default currency, timezone and language.',
              ),
            ),
            Expanded(
              child: ListView.builder(
                itemCount: _regions.length,
                itemBuilder: (context, i) {
                  final (code, name) = _regions[i];
                  return RadioListTile<String>(
                    value: code,
                    groupValue: _selected,
                    onChanged: (v) => setState(() => _selected = v),
                    title: Text(name),
                    subtitle: Text(code),
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _selected == null || _saving ? null : _confirm,
                  child: _saving
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Continue'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
