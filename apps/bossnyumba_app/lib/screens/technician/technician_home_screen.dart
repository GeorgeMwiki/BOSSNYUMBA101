import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth_provider.dart';
import '../../core/api_client.dart';

class TechnicianHomeScreen extends StatefulWidget {
  const TechnicianHomeScreen({super.key});

  @override
  State<TechnicianHomeScreen> createState() => _TechnicianHomeScreenState();
}

class _TechnicianHomeScreenState extends State<TechnicianHomeScreen> {
  List<dynamic> _jobs = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadJobs();
  }

  Future<void> _loadJobs() async {
    setState(() => _loading = true);
    try {
      final resp = await ApiClient.instance.get<Map<String, dynamic>>('/work-orders');
      if (!mounted) return;
      if (resp.isOk && resp.data != null) {
        final data = resp.data!;
        final items = data['items'] ?? (data is List ? data : []);
        setState(() { _jobs = items is List ? items : []; _loading = false; });
      } else {
        setState(() { _jobs = []; _loading = false; });
      }
    } catch (_) {
      if (!mounted) return;
      setState(() { _jobs = []; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final session = auth.session;
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    final activeJobs = _jobs.where((j) {
      final s = ((j as Map)['status'] ?? '').toString().toUpperCase();
      return s == 'ASSIGNED' || s == 'IN_PROGRESS';
    }).toList();
    final completedJobs = _jobs.where((j) {
      final s = ((j as Map)['status'] ?? '').toString().toUpperCase();
      return s == 'COMPLETED' || s == 'RESOLVED';
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Jobs'),
        actions: [IconButton(icon: const Icon(Icons.notifications_outlined), onPressed: () {})],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadJobs,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Welcome
                  Text('Hello, ${session?.firstName ?? "Technician"}', style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  Text('${activeJobs.length} active job${activeJobs.length != 1 ? "s" : ""}', style: theme.textTheme.bodyMedium),
                  const SizedBox(height: 20),

                  // Stats row
                  Row(children: [
                    Expanded(child: _StatCard(label: 'Active', value: '${activeJobs.length}', color: cs.primary)),
                    const SizedBox(width: 12),
                    Expanded(child: _StatCard(label: 'Completed', value: '${completedJobs.length}', color: const Color(0xFF10B981))),
                    const SizedBox(width: 12),
                    Expanded(child: _StatCard(label: 'Total', value: '${_jobs.length}', color: const Color(0xFF64748B))),
                  ]),
                  const SizedBox(height: 24),

                  if (activeJobs.isNotEmpty) ...[
                    Text('Active Jobs', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    ...activeJobs.map((j) => _JobCard(job: j as Map<String, dynamic>, onStatusChange: _updateStatus)),
                    const SizedBox(height: 24),
                  ],

                  if (_jobs.isEmpty)
                    Center(child: Column(children: [
                      const SizedBox(height: 40),
                      Icon(Icons.engineering, size: 64, color: Colors.grey[600]),
                      const SizedBox(height: 16),
                      const Text('No jobs assigned yet'),
                    ])),
                ],
              ),
            ),
    );
  }

  Future<void> _updateStatus(String jobId, String newStatus) async {
    await ApiClient.instance.patch<Map<String, dynamic>>(
      '/work-orders/$jobId',
      body: {'status': newStatus},
    );
    _loadJobs();
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _StatCard({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withAlpha(20),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withAlpha(51)),
      ),
      child: Column(children: [
        Text(value, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: color)),
        const SizedBox(height: 4),
        Text(label, style: TextStyle(fontSize: 12, color: color)),
      ]),
    );
  }
}

class _JobCard extends StatelessWidget {
  final Map<String, dynamic> job;
  final Future<void> Function(String, String) onStatusChange;

  const _JobCard({required this.job, required this.onStatusChange});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final status = (job['status'] ?? 'ASSIGNED').toString().toUpperCase();
    final priority = (job['priority'] ?? 'MEDIUM').toString().toUpperCase();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(job['title'] ?? 'Work Order', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16))),
            _PriorityBadge(priority: priority),
          ]),
          const SizedBox(height: 8),
          if (job['description'] != null)
            Text(job['description']!, style: Theme.of(context).textTheme.bodySmall, maxLines: 2, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 8),
          if (job['propertyName'] != null || job['unitId'] != null)
            Row(children: [
              const Icon(Icons.location_on_outlined, size: 14),
              const SizedBox(width: 4),
              Text('${job['propertyName'] ?? ''} ${job['unitId'] != null ? "- Unit ${job['unitId']}" : ""}',
                style: Theme.of(context).textTheme.bodySmall),
            ]),
          const SizedBox(height: 12),
          Row(children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: status == 'IN_PROGRESS' ? const Color(0xFFF59E0B).withAlpha(25) : cs.primary.withAlpha(25),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(status, style: TextStyle(
                fontSize: 11, fontWeight: FontWeight.w600,
                color: status == 'IN_PROGRESS' ? const Color(0xFFF59E0B) : cs.primary,
              )),
            ),
            const Spacer(),
            if (status == 'ASSIGNED')
              FilledButton.tonal(
                onPressed: () => onStatusChange(job['id']?.toString() ?? '', 'IN_PROGRESS'),
                child: const Text('Start'),
              ),
            if (status == 'IN_PROGRESS')
              FilledButton(
                onPressed: () => onStatusChange(job['id']?.toString() ?? '', 'COMPLETED'),
                child: const Text('Complete'),
              ),
          ]),
        ]),
      ),
    );
  }
}

class _PriorityBadge extends StatelessWidget {
  final String priority;
  const _PriorityBadge({required this.priority});

  @override
  Widget build(BuildContext context) {
    Color color;
    switch (priority) {
      case 'URGENT': color = const Color(0xFFF43F5E); break;
      case 'HIGH': color = const Color(0xFFF59E0B); break;
      case 'LOW': color = const Color(0xFF64748B); break;
      default: color = const Color(0xFF10B981);
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: color.withAlpha(25), borderRadius: BorderRadius.circular(6), border: Border.all(color: color.withAlpha(76))),
      child: Text(priority, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: color)),
    );
  }
}
