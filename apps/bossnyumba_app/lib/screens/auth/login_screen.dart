import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/auth_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _phoneFormKey = GlobalKey<FormState>();
  final _emailFormKey = GlobalKey<FormState>();

  final _phoneController = TextEditingController(text: '+255');
  final _otpController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _loading = false;
  bool _otpSent = false;
  bool _obscurePassword = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() => setState(() => _error = null));
  }

  @override
  void dispose() {
    _tabController.dispose();
    _phoneController.dispose();
    _otpController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _sendOtp() async {
    if (_loading) return;
    if (!(_phoneFormKey.currentState?.validate() ?? false)) return;
    setState(() { _error = null; _loading = true; });
    try {
      final ok = await context.read<AuthProvider>().sendOtp(_phoneController.text.trim());
      if (!mounted) return;
      if (ok) {
        setState(() { _otpSent = true; _loading = false; });
      } else {
        setState(() { _error = 'Failed to send OTP. Check your number.'; _loading = false; });
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

  Future<void> _loginWithEmail() async {
    if (_loading) return;
    if (!(_emailFormKey.currentState?.validate() ?? false)) return;
    setState(() { _error = null; _loading = true; });
    try {
      final ok = await context.read<AuthProvider>().login(
        _emailController.text.trim(),
        _passwordController.text,
      );
      if (!mounted) return;
      if (!ok) setState(() { _error = 'Invalid email or password'; _loading = false; });
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
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 48),
              // Logo
              Center(
                child: Container(
                  width: 72, height: 72,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [cs.primary, cs.primary.withAlpha(180)],
                      begin: Alignment.topLeft, end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Center(
                    child: Text('BN', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Colors.white)),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Text('BOSSNYUMBA', style: theme.textTheme.headlineLarge?.copyWith(color: cs.primary), textAlign: TextAlign.center),
              const SizedBox(height: 4),
              Text('Smart Property Management', style: theme.textTheme.bodyMedium, textAlign: TextAlign.center),
              const SizedBox(height: 36),

              // Tab bar
              Container(
                decoration: BoxDecoration(
                  color: cs.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF334155)),
                ),
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
                height: _otpSent ? 300 : 260,
                child: TabBarView(
                  controller: _tabController,
                  children: [_buildPhoneTab(theme, cs), _buildEmailTab(theme, cs)],
                ),
              ),

              if (_error != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: cs.error.withAlpha(25),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: cs.error.withAlpha(76)),
                  ),
                  child: Row(children: [
                    Icon(Icons.error_outline, color: cs.error, size: 20),
                    const SizedBox(width: 8),
                    Expanded(child: Text(_error!, style: TextStyle(color: cs.error, fontSize: 13))),
                  ]),
                ),
              ],
              const SizedBox(height: 24),
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Text("Don't have an account?", style: theme.textTheme.bodyMedium),
                TextButton(onPressed: () => context.go('/register'), child: const Text('Sign up')),
              ]),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPhoneTab(ThemeData theme, ColorScheme cs) {
    if (_otpSent) {
      return Form(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text('Enter verification code', style: theme.textTheme.titleMedium),
        const SizedBox(height: 4),
        Text('Sent to ${_phoneController.text}', style: theme.textTheme.bodySmall),
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
              : const Text('Verify & Sign In'),
        ),
        const SizedBox(height: 8),
        TextButton(
          onPressed: _loading ? null : () => setState(() { _otpSent = false; _otpController.clear(); _error = null; }),
          child: const Text('Change number'),
        ),
      ]));
    }

    return Form(key: _phoneFormKey, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text('Sign in with phone', style: theme.textTheme.titleMedium),
      const SizedBox(height: 4),
      Text('We\'ll send a verification code via SMS', style: theme.textTheme.bodySmall),
      const SizedBox(height: 20),
      TextFormField(
        controller: _phoneController,
        keyboardType: TextInputType.phone,
        decoration: const InputDecoration(labelText: 'Phone number', hintText: '+255 7XX XXX XXX', prefixIcon: Icon(Icons.phone_outlined)),
        validator: (v) => (v == null || v.length < 10) ? 'Enter a valid phone number' : null,
      ),
      const SizedBox(height: 20),
      FilledButton(
        onPressed: _loading ? null : _sendOtp,
        child: _loading
            ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : const Text('Send OTP'),
      ),
    ]));
  }

  Widget _buildEmailTab(ThemeData theme, ColorScheme cs) {
    return Form(key: _emailFormKey, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text('Sign in with email', style: theme.textTheme.titleMedium),
      const SizedBox(height: 20),
      TextFormField(
        controller: _emailController,
        keyboardType: TextInputType.emailAddress,
        decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.email_outlined)),
        validator: (v) => (v == null || v.isEmpty) ? 'Email required' : null,
      ),
      const SizedBox(height: 16),
      TextFormField(
        controller: _passwordController,
        obscureText: _obscurePassword,
        decoration: InputDecoration(
          labelText: 'Password', prefixIcon: const Icon(Icons.lock_outlined),
          suffixIcon: IconButton(
            icon: Icon(_obscurePassword ? Icons.visibility_off : Icons.visibility),
            onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
          ),
        ),
        validator: (v) => (v == null || v.isEmpty) ? 'Password required' : null,
      ),
      const SizedBox(height: 20),
      FilledButton(
        onPressed: _loading ? null : _loginWithEmail,
        child: _loading
            ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : const Text('Sign In'),
      ),
    ]));
  }
}
