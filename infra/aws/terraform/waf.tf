# -----------------------------------------------------------------------------
# WAF v2 Web ACL (P2 hardening)
# - ALB: REGIONAL scope (api + web)
# - CloudFront media: CLOUDFRONT scope (us-east-1)
# Staging: rules in COUNT mode; prod: BLOCK mode
# -----------------------------------------------------------------------------
variable "enable_waf" {
  type        = bool
  default     = false
  description = "Enable WAF Web ACL for ALB and CloudFront. Auto-enabled when enable_ha = true."
}

variable "waf_rule_action" {
  type        = string
  default     = null
  description = "WAF managed rule action: count (staging) or block (prod). Null = derive from environment."
}

locals {
  waf_action = coalesce(var.waf_rule_action, var.environment == "prod" ? "block" : "count")
}

# Regional WAF for ALB
resource "aws_wafv2_web_acl" "alb" {
  count       = local.ha_enable_waf && var.enable_alb ? 1 : 0
  name        = "${local.name_prefix}-alb-waf"
  description = "WAF for ALB api and web"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1
    override_action {
      dynamic "count" {
        for_each = local.waf_action == "count" ? [1] : []
        content {}
      }
      dynamic "none" {
        for_each = local.waf_action == "block" ? [1] : []
        content {}
      }
    }
    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "CommonRuleSet"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "RateLimitRule"
    priority = 2
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitRule"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.name_prefix}-alb-waf"
    sampled_requests_enabled   = true
  }

  tags = { Name = "${local.name_prefix}-alb-waf" }
}

resource "aws_wafv2_web_acl_association" "alb" {
  count        = local.ha_enable_waf && var.enable_alb ? 1 : 0
  resource_arn = aws_lb.main[0].arn
  web_acl_arn  = aws_wafv2_web_acl.alb[0].arn
}

# CloudFront WAF (must be in us-east-1, CLOUDFRONT scope)
# Shared by all CloudFront distributions (media + web)
resource "aws_wafv2_web_acl" "cloudfront" {
  count       = local.ha_enable_waf && var.enable_cloudfront ? 1 : 0
  provider    = aws.us_east_1
  name        = "${local.name_prefix}-cf-waf"
  description = "WAF for CloudFront distributions - media and web"
  scope       = "CLOUDFRONT"

  default_action {
    allow {}
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1
    override_action {
      dynamic "count" {
        for_each = local.waf_action == "count" ? [1] : []
        content {}
      }
      dynamic "none" {
        for_each = local.waf_action == "block" ? [1] : []
        content {}
      }
    }
    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "CommonRuleSet"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "RateLimitRule"
    priority = 2
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitRule"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.name_prefix}-cf-waf"
    sampled_requests_enabled   = true
  }

  tags = { Name = "${local.name_prefix}-cf-waf" }
}
