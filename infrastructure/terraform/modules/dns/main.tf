# =============================================================================
# DNS + ACM Module - Route53 zone + ACM certificate for BOSSNYUMBA
# =============================================================================
# Creates a Route53 hosted zone (or uses an existing one) and an ACM
# certificate covering the root domain + api/app subdomains, with
# DNS-validated issuance and an alias record pointing at the ALB.
# =============================================================================

# -----------------------------------------------------------------------------
# Hosted Zone (create if requested, otherwise look up existing)
# -----------------------------------------------------------------------------
resource "aws_route53_zone" "main" {
  count = var.create_zone ? 1 : 0
  name  = var.domain_name

  tags = {
    Name        = var.domain_name
    Environment = var.environment
  }
}

data "aws_route53_zone" "existing" {
  count        = var.create_zone ? 0 : 1
  name         = var.domain_name
  private_zone = false
}

locals {
  zone_id   = var.create_zone ? aws_route53_zone.main[0].zone_id : data.aws_route53_zone.existing[0].zone_id
  zone_name = var.create_zone ? aws_route53_zone.main[0].name : data.aws_route53_zone.existing[0].name
}

# -----------------------------------------------------------------------------
# ACM Certificate (covers root + subdomains)
# -----------------------------------------------------------------------------
resource "aws_acm_certificate" "main" {
  domain_name               = var.domain_name
  subject_alternative_names = var.subject_alternative_names
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-cert"
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# DNS validation records
# -----------------------------------------------------------------------------
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = local.zone_id
}

resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

# -----------------------------------------------------------------------------
# ALB alias records (one per subdomain)
# -----------------------------------------------------------------------------
resource "aws_route53_record" "alb_alias" {
  for_each = toset(var.alb_alias_names)

  zone_id = local.zone_id
  name    = each.value
  type    = "A"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }
}
