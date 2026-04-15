# =============================================================================
# Staging Environment - Outputs
# =============================================================================

output "vpc_id" {
  value = module.vpc.vpc_id
}

output "api_url" {
  value       = module.ecs.api_url
  description = "API base URL"
}

output "alb_dns_name" {
  value = module.ecs.alb_dns_name
}

output "rds_endpoint" {
  value     = module.rds.endpoint
  sensitive = true
}

output "redis_endpoint" {
  value = module.redis.endpoint
}

output "documents_bucket" {
  value = module.s3.bucket_id
}

output "reports_bucket" {
  value = module.s3.reports_bucket_id
}

output "ecr_registry_url" {
  value = module.ecr.registry_url
}

output "event_topic_arns" {
  value = module.messaging.topic_arns
}

output "event_queue_urls" {
  value = module.messaging.queue_urls
}

output "alarm_topic_arn" {
  value = module.monitoring.alarm_topic_arn
}

output "waf_web_acl_arn" {
  value = module.waf.web_acl_arn
}

output "certificate_arn" {
  value       = var.domain_name == "" ? null : module.dns[0].certificate_arn
  description = "Validated ACM certificate ARN (null when domain_name unset)"
}
