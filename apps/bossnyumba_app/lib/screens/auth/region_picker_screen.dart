import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Shown once on first launch (before login). Captures the user's
/// region (TZ / KE / OTHER) and language preference. Persists to
/// SharedPreferences so it survives app restarts and can be sent to
/// the server on login.
class RegionPickerScreen extends StatefulWidget {
  const RegionPickerScreen({super.key});

  @override
  State<RegionPickerScreen> createState() => _RegionPickerScreenState();
}

class _RegionPickerScreenState extends State<RegionPickerScreen> {
  String _selectedRegion = '';
  String _selectedLanguage = 'en';

  static const _regions = [
    _RegionOption(code: 'TZ', label: 'Tanzania', emoji: '🇹🇿', greeting: 'Karibu!', defaultLang: 'sw'),
    _RegionOption(code: 'KE', label: 'Kenya', emoji: '🇰🇪', greeting: 'Karibu!', defaultLang: 'en'),
    _RegionOption(code: 'OTHER', label: 'Other', emoji: '🌍', greeting: 'Welcome!', defaultLang: 'en'),
  ];

  Future<void> _continue() async {
    if (_selectedRegion.isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('bossnyumba:region', _selectedRegion);
    await prefs.setString('bossnyumba:language', _selectedLanguage);
    await prefs.setBool('bossnyumba:onboarded', true);
    if (mounted) context.go('/auth/login');
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(flex: 1),
              Text(
                'Where are you?',
                style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'This helps us show the right policies, language, and tax rules for your region.',
                style: theme.textTheme.bodyMedium?.copyWith(color: Colors.grey[600]),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              ..._regions.map((r) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _RegionCard(
                  option: r,
                  selected: _selectedRegion == r.code,
                  onTap: () {
                    setState(() {
                      _selectedRegion = r.code;
                      _selectedLanguage = r.defaultLang;
                    });
                  },
                ),
              )),
              const SizedBox(height: 24),
              // Language toggle
              if (_selectedRegion.isNotEmpty) ...[
                Text('Language', style: theme.textTheme.labelLarge, textAlign: TextAlign.center),
                const SizedBox(height: 8),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'en', label: Text('English')),
                    ButtonSegment(value: 'sw', label: Text('Kiswahili')),
                  ],
                  selected: {_selectedLanguage},
                  onSelectionChanged: (v) => setState(() => _selectedLanguage = v.first),
                ),
              ],
              const Spacer(flex: 2),
              FilledButton(
                onPressed: _selectedRegion.isNotEmpty ? _continue : null,
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                ),
                child: const Text('Continue'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RegionOption {
  final String code;
  final String label;
  final String emoji;
  final String greeting;
  final String defaultLang;

  const _RegionOption({
    required this.code,
    required this.label,
    required this.emoji,
    required this.greeting,
    required this.defaultLang,
  });
}

class _RegionCard extends StatelessWidget {
  final _RegionOption option;
  final bool selected;
  final VoidCallback onTap;

  const _RegionCard({required this.option, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? Theme.of(context).colorScheme.primaryContainer : Colors.grey[100],
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
          child: Row(
            children: [
              Text(option.emoji, style: const TextStyle(fontSize: 32)),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      option.label,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
                    ),
                    Text(
                      option.greeting,
                      style: TextStyle(color: Colors.grey[600], fontSize: 13),
                    ),
                  ],
                ),
              ),
              if (selected) Icon(Icons.check_circle, color: Theme.of(context).colorScheme.primary),
            ],
          ),
        ),
      ),
    );
  }
}
