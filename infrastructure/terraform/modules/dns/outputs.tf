output "zone_id" {
  description = "Route53 hosted zone ID"
  value       = local.zone_id
}

output "zone_name" {
  description = "Hosted zone name"
  value       = local.zone_name
}

output "certificate_arn" {
  description = "Validated ACM certificate ARN"
  value       = aws_acm_certificate_validation.main.certificate_arn
}

output "alias_records" {
  description = "Map of FQDN to Route53 alias record ID"
  value       = { for k, r in aws_route53_record.alb_alias : k => r.fqdn }
}
