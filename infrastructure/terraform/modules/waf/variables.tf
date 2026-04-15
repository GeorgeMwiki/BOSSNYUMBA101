variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "alb_arn" {
  description = "ARN of the ALB to associate with the WAF. Leave empty to skip association."
  type        = string
  default     = ""
}

variable "rate_limit_per_5_minutes" {
  description = "Per-IP request ceiling over a 5-minute sliding window"
  type        = number
  default     = 2000
}
