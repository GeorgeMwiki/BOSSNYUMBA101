import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/auth_provider.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _phoneFormKey = GlobalKey<FormState>();
  final _emailFormKey = GlobalKey<FormState>();

  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _phoneController = TextEditingController(text: '+255');
  final _otpController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _optionalPhoneController = TextEditingController();

  bool _loading = false;
  bool _otpSent = false;
  bool _obscurePassword = true;
  String? _error;
  String? _success;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() => setState(() { _error = null; _success = null; }));
  }

  @override
  void dispose() {
    _tabController.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    _otpController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _optionalPhoneController.dispose();
    super.dispose();
  }

  Future<void> _registerWithPhone() async {
    if (_loading) return;
    if (!(_phoneFormKey.currentState?.validate() ?? false)) return;
    setState(() { _error = null; _loading = true; });
    try {
      final ok = await context.read<AuthProvider>().registerWithPhone(
        _phoneController.text.trim(),
        _firstNameController.text.trim(),
        _lastNameController.text.trim(),
      );
      if (!mounted) return;
      if (ok) {
        setState(() { _otpSent = true; _loading = false; });
      } else {
        setState(() { _error = 'Registration failed. Number may already be registered.'; _loading = false; });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _verifyOtp() async {
    if (_loading) return;
    if (_otpController.text.trim().length != 6) {
      setState(() => _error = 'Enter 6-digit code');
      return;
    }
    setState(() { _error = null; _loading = true; });
    try {
      final ok = await context.read<AuthProvider>().verifyOtp(_otpController.text.trim());
      if (!mounted) return;
      if (!ok) setState(() { _error = 'Invalid code. Try again.'; _loading = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _registerWithEmail() async {
    if (_loading) return;
    if (!(_emailFormKey.currentState?.validate() ?? false)) return;
    setState(() { _error = null; _loading = true; });
    try {
      final ok = await context.read<AuthProvider>().registerWithEmail(
        _emailController.text.trim(),
        _passwordController.text,
        _firstNameController.text.trim(),
        _lastNameController.text.trim(),
        phone: _optionalPhoneController.text.trim().isEmpty ? null : _optionalPhoneController.text.trim(),
      );
      if (!mounted) return;
      if (ok) {
        final auth = context.read<AuthProvider>();
        if (!auth.isAuthenticated) {
          setState(() { _success = 'Account created! Check your email to verify.'; _loading = false; });
        }
      } else {
        setState(() { _error = 'Registration failed. Email may already be in use.'; _loading = false; });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.go('/login'))),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Create Account', style: theme.textTheme.headlineMedium),
            const SizedBox(height: 4),
            Text('Join BOSSNYUMBA today', style: theme.textTheme.bodyMedium),
            const SizedBox(height: 24),

            Row(children: [
              Expanded(child: TextFormField(
                controller: _firstNameController,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(labelText: 'First name', prefixIcon: Icon(Icons.person_outline)),
              )),
              const SizedBox(width: 12),
              Expanded(child: TextFormField(
                controller: _lastNameController,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(labelText: 'Last name'),
              )),
            ]),
            const SizedBox(height: 20),

            Container(
              decoration: BoxDecoration(color: cs.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFF334155))),
              child: TabBar(
                controller: _tabController,
                indicatorSize: TabBarIndicatorSize.tab,
                indicator: BoxDecoration(color: cs.primary.withAlpha(38), borderRadius: BorderRadius.circular(10)),
                labelColor: cs.primary,
                unselectedLabelColor: const Color(0xFF64748B),
                labelStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                dividerHeight: 0,
                tabs: const [Tab(text: 'Phone'), Tab(text: 'Email')],
              ),
            ),
            const SizedBox(height: 24),

            SizedBox(
              height: _otpSent ? 260 : 200,
              child: TabBarView(controller: _tabController, children: [_buildPhoneTab(theme), _buildEmailTab(theme)]),
            ),

            if (_error != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: cs.error.withAlpha(25), borderRadius: BorderRadius.circular(12), border: Border.all(color: cs.error.withAlpha(76))),
                child: Row(children: [
                  Icon(Icons.error_outline, color: cs.error, size: 20),
                  const SizedBox(width: 8),
                  Expanded(child: Text(_error!, style: TextStyle(color: cs.error, fontSize: 13))),
                ]),
              ),
            ],
            if (_success != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: cs.primary.withAlpha(25), borderRadius: BorderRadius.circular(12), border: Border.all(color: cs.primary.withAlpha(76))),
                child: Row(children: [
                  Icon(Icons.check_circle_outline, color: cs.primary, size: 20),
                  const SizedBox(width: 8),
                  Expanded(child: Text(_success!, style: TextStyle(color: cs.primary, fontSize: 13))),
                ]),
              ),
            ],
            const SizedBox(height: 24),
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Text('Already have an account?', style: theme.textTheme.bodyMedium),
              TextButton(onPressed: () => context.go('/login'), child: const Text('Sign in')),
            ]),
            const SizedBox(height: 24),
          ]),
        ),
      ),
    );
  }

  Widget _buildPhoneTab(ThemeData theme) {
    if (_otpSent) {
      return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text('Verify your number', style: theme.textTheme.titleMedium),
        const SizedBox(height: 4),
        Text('Code sent to ${_phoneController.text}', style: theme.textTheme.bodySmall),
        const SizedBox(height: 20),
        TextFormField(
          controller: _otpController,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w600, letterSpacing: 8),
          decoration: const InputDecoration(hintText: '000000', prefixIcon: Icon(Icons.lock_outlined)),
        ),
        const SizedBox(height: 20),
        FilledButton(
          onPressed: _loading ? null : _verifyOtp,
          child: _loading
              ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Verify & Create Account'),
        ),
        TextButton(
          onPressed: _loading ? null : () => setState(() { _otpSent = false; _otpController.clear(); _error = null; }),
          child: const Text('Change number'),
        ),
      ]);
    }

    return Form(key: _phoneFormKey, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text('Register with phone', style: theme.textTheme.titleMedium),
      const SizedBox(height: 4),
      Text('Fastest way to get started', style: theme.textTheme.bodySmall),
      const SizedBox(height: 20),
      TextFormField(
        controller: _phoneController,
        keyboardType: TextInputType.phone,
        decoration: const InputDecoration(labelText: 'Phone number', hintText: '+255 7XX XXX XXX', prefixIcon: Icon(Icons.phone_outlined)),
        validator: (v) {
          if (v == null || v.length < 10) return 'Enter a valid phone number';
          if (_firstNameController.text.trim().isEmpty) return 'Enter your first name above';
          return null;
        },
      ),
      const SizedBox(height: 20),
      FilledButton(
        onPressed: _loading ? null : _registerWithPhone,
        child: _loading
            ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : const Text('Send Verification Code'),
      ),
    ]));
  }

  Widget _buildEmailTab(ThemeData theme) {
    return Form(key: _emailFormKey, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      TextFormField(
        controller: _emailController, keyboardType: TextInputType.emailAddress,
        decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.email_outlined)),
        validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
      ),
      const SizedBox(height: 12),
      TextFormField(
        controller: _passwordController, obscureText: _obscurePassword,
        decoration: InputDecoration(
          labelText: 'Password (min 8)', prefixIcon: const Icon(Icons.lock_outlined),
          suffixIcon: IconButton(icon: Icon(_obscurePassword ? Icons.visibility_off : Icons.visibility), onPressed: () => setState(() => _obscurePassword = !_obscurePassword)),
        ),
        validator: (v) => (v == null || v.length < 8) ? 'At least 8 characters' : null,
      ),
      const SizedBox(height: 12),
      TextFormField(
        controller: _optionalPhoneController, keyboardType: TextInputType.phone,
        decoration: const InputDecoration(labelText: 'Phone (optional)', prefixIcon: Icon(Icons.phone_outlined)),
      ),
      const SizedBox(height: 16),
      FilledButton(
        onPressed: _loading ? null : _registerWithEmail,
        child: _loading
            ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : const Text('Create Account'),
      ),
    ]));
  }
}
