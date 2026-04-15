output "topic_arns" {
  description = "Map of event domain to SNS topic ARN"
  value       = { for k, t in aws_sns_topic.events : k => t.arn }
}

output "queue_arns" {
  description = "Map of event domain to SQS queue ARN"
  value       = { for k, q in aws_sqs_queue.events : k => q.arn }
}

output "queue_urls" {
  description = "Map of event domain to SQS queue URL"
  value       = { for k, q in aws_sqs_queue.events : k => q.id }
}

output "dlq_arns" {
  description = "Map of event domain to DLQ ARN"
  value       = { for k, q in aws_sqs_queue.dlq : k => q.arn }
}

output "iam_policy_arn" {
  description = "IAM policy ARN granting publish/consume access"
  value       = aws_iam_policy.messaging_access.arn
}
