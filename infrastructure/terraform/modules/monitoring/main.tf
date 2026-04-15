# =============================================================================
# Monitoring Module - CloudWatch alarms + dashboard for BOSSNYUMBA
# =============================================================================
# Creates alarms for critical failure modes (ALB 5xx, high ECS CPU/memory,
# RDS CPU/storage, Redis CPU/evictions, SQS DLQ depth) and a single
# dashboard that visualises the stack at a glance. An SNS topic aggregates
# alarm notifications so humans can subscribe via email/Slack.
# =============================================================================

# -----------------------------------------------------------------------------
# SNS alarm topic
# -----------------------------------------------------------------------------
resource "aws_sns_topic" "alarms" {
  name              = "${var.project_name}-${var.environment}-alarms"
  kms_master_key_id = "alias/aws/sns"

  tags = {
    Name        = "${var.project_name}-${var.environment}-alarms"
    Environment = var.environment
  }
}

resource "aws_sns_topic_subscription" "alarm_emails" {
  for_each = toset(var.alarm_email_recipients)

  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = each.value
}

locals {
  alarm_actions = [aws_sns_topic.alarms.arn]
}

# -----------------------------------------------------------------------------
# ALB - 5xx rate
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${var.project_name}-${var.environment}-alb-5xx"
  alarm_description   = "ALB returning elevated 5xx responses"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_ELB_5XX_Count"
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 5
  threshold           = var.alb_5xx_threshold
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions

  tags = {
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# ECS CPU / Memory
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "ecs_cpu" {
  for_each = toset(var.ecs_service_names)

  alarm_name          = "${var.project_name}-${var.environment}-${each.value}-cpu"
  alarm_description   = "ECS service ${each.value} CPU utilization high"
  namespace           = "AWS/ECS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 60
  evaluation_periods  = 5
  threshold           = 85
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = each.value
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "ecs_memory" {
  for_each = toset(var.ecs_service_names)

  alarm_name          = "${var.project_name}-${var.environment}-${each.value}-memory"
  alarm_description   = "ECS service ${each.value} memory utilization high"
  namespace           = "AWS/ECS"
  metric_name         = "MemoryUtilization"
  statistic           = "Average"
  period              = 60
  evaluation_periods  = 5
  threshold           = 85
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = each.value
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions
}

# -----------------------------------------------------------------------------
# RDS CPU + free storage
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  count = var.rds_instance_identifier == "" ? 0 : 1

  alarm_name          = "${var.project_name}-${var.environment}-rds-cpu"
  alarm_description   = "RDS CPU utilization high"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 60
  evaluation_periods  = 10
  threshold           = 80
  comparison_operator = "GreaterThanOrEqualToThreshold"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_identifier
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "rds_free_storage" {
  count = var.rds_instance_identifier == "" ? 0 : 1

  alarm_name          = "${var.project_name}-${var.environment}-rds-free-storage"
  alarm_description   = "RDS free storage low"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = var.rds_free_storage_bytes_threshold
  comparison_operator = "LessThanOrEqualToThreshold"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_identifier
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions
}

# -----------------------------------------------------------------------------
# Redis CPU + evictions
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  count = var.redis_replication_group_id == "" ? 0 : 1

  alarm_name          = "${var.project_name}-${var.environment}-redis-cpu"
  alarm_description   = "ElastiCache Redis CPU utilization high"
  namespace           = "AWS/ElastiCache"
  metric_name         = "EngineCPUUtilization"
  statistic           = "Average"
  period              = 60
  evaluation_periods  = 5
  threshold           = 80
  comparison_operator = "GreaterThanOrEqualToThreshold"

  dimensions = {
    ReplicationGroupId = var.redis_replication_group_id
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions
}

# -----------------------------------------------------------------------------
# SQS Dead Letter Queue depth (across all DLQs passed in)
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "sqs_dlq_depth" {
  for_each = toset(var.dlq_names)

  alarm_name          = "${var.project_name}-${var.environment}-${each.value}-dlq-depth"
  alarm_description   = "Messages accumulating in DLQ ${each.value}"
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = each.value
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions
}

# -----------------------------------------------------------------------------
# CloudWatch Dashboard
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.project_name}-${var.environment}"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "ALB Requests / 5xx"
          region  = var.aws_region
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.alb_arn_suffix],
            [".", "HTTPCode_ELB_5XX_Count", ".", "."],
            [".", "TargetResponseTime", ".", "."],
          ]
          stat   = "Sum"
          period = 60
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "ECS CPU / Memory"
          region  = var.aws_region
          metrics = flatten([
            for svc in var.ecs_service_names : [
              ["AWS/ECS", "CPUUtilization", "ClusterName", var.ecs_cluster_name, "ServiceName", svc],
              [".", "MemoryUtilization", ".", ".", ".", svc],
            ]
          ])
          stat   = "Average"
          period = 60
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title   = "RDS"
          region  = var.aws_region
          metrics = var.rds_instance_identifier == "" ? [] : [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", var.rds_instance_identifier],
            [".", "DatabaseConnections", ".", "."],
            [".", "FreeStorageSpace", ".", "."],
          ]
          stat   = "Average"
          period = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          title   = "Redis"
          region  = var.aws_region
          metrics = var.redis_replication_group_id == "" ? [] : [
            ["AWS/ElastiCache", "EngineCPUUtilization", "ReplicationGroupId", var.redis_replication_group_id],
            [".", "DatabaseMemoryUsagePercentage", ".", "."],
            [".", "Evictions", ".", "."],
          ]
          stat   = "Average"
          period = 300
        }
      },
    ]
  })
}
