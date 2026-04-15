# =============================================================================
# Messaging Module - SQS queues + SNS topics for BOSSNYUMBA domain events
# =============================================================================
# Creates a fan-out topology: SNS topics per domain event type with SQS
# subscribers that services can consume. Each queue has a dead-letter queue
# for poison-message handling. All queues are encrypted with AWS-managed
# KMS keys and enforce server-side encryption.
# =============================================================================

locals {
  event_topics = toset([
    "payments",       # rent payments, disbursements
    "work-orders",    # maintenance lifecycle
    "notifications",  # outbound email/SMS/push
    "documents",      # uploads, signing, intelligence
    "audit",          # audit log stream
  ])
}

# -----------------------------------------------------------------------------
# SNS Topics (per event domain)
# -----------------------------------------------------------------------------
resource "aws_sns_topic" "events" {
  for_each = local.event_topics

  name              = "${var.project_name}-${var.environment}-${each.value}"
  kms_master_key_id = "alias/aws/sns"

  tags = {
    Name        = "${var.project_name}-${var.environment}-${each.value}"
    Environment = var.environment
    EventDomain = each.value
  }
}

# -----------------------------------------------------------------------------
# Dead-letter Queues
# -----------------------------------------------------------------------------
resource "aws_sqs_queue" "dlq" {
  for_each = local.event_topics

  name                       = "${var.project_name}-${var.environment}-${each.value}-dlq"
  message_retention_seconds  = 1209600 # 14 days
  visibility_timeout_seconds = 60
  sqs_managed_sse_enabled    = true

  tags = {
    Name        = "${var.project_name}-${var.environment}-${each.value}-dlq"
    Environment = var.environment
    EventDomain = each.value
  }
}

# -----------------------------------------------------------------------------
# Main Queues (subscribed to the SNS topic)
# -----------------------------------------------------------------------------
resource "aws_sqs_queue" "events" {
  for_each = local.event_topics

  name                       = "${var.project_name}-${var.environment}-${each.value}"
  message_retention_seconds  = 345600 # 4 days
  visibility_timeout_seconds = var.visibility_timeout_seconds
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq[each.value].arn
    maxReceiveCount     = var.max_receive_count
  })

  tags = {
    Name        = "${var.project_name}-${var.environment}-${each.value}"
    Environment = var.environment
    EventDomain = each.value
  }
}

# -----------------------------------------------------------------------------
# SQS queue policy (allow SNS to publish)
# -----------------------------------------------------------------------------
resource "aws_sqs_queue_policy" "events" {
  for_each = local.event_topics

  queue_url = aws_sqs_queue.events[each.value].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowSNSPublish"
        Effect    = "Allow"
        Principal = { Service = "sns.amazonaws.com" }
        Action    = "sqs:SendMessage"
        Resource  = aws_sqs_queue.events[each.value].arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_sns_topic.events[each.value].arn
          }
        }
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# SNS -> SQS subscriptions
# -----------------------------------------------------------------------------
resource "aws_sns_topic_subscription" "events" {
  for_each = local.event_topics

  topic_arn            = aws_sns_topic.events[each.value].arn
  protocol             = "sqs"
  endpoint             = aws_sqs_queue.events[each.value].arn
  raw_message_delivery = true
}

# -----------------------------------------------------------------------------
# IAM policy for application access
# -----------------------------------------------------------------------------
resource "aws_iam_policy" "messaging_access" {
  name        = "${var.project_name}-${var.environment}-messaging-access"
  description = "Publish to SNS topics and consume from SQS queues"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sns:Publish",
          "sns:GetTopicAttributes",
        ]
        Resource = [for t in aws_sns_topic.events : t.arn]
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl",
          "sqs:ChangeMessageVisibility",
        ]
        Resource = concat(
          [for q in aws_sqs_queue.events : q.arn],
          [for q in aws_sqs_queue.dlq : q.arn],
        )
      }
    ]
  })
}
