#!/usr/bin/env bash
# Manual AWS cleanup when terraform destroy gets stuck on dependencies.
# Run BEFORE terraform destroy if previous destroys failed.
# Usage: ./scripts/deploy/prod-manual-cleanup.sh
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
VPC_ID="${VPC_ID:-vpc-01cc3927aca442993}"

echo "=== Manual prod cleanup (unblock terraform destroy) ==="
echo "VPC: $VPC_ID"

# 1. Delete ElastiCache replication group (required before subnet group)
echo "[1] ElastiCache..."
aws elasticache delete-replication-group --replication-group-id zinovia-fans-prod-redis --region "$AWS_REGION" 2>/dev/null && echo "  Redis deleting" || echo "  Redis already gone or not found"

# 2. Delete ALB (releases ENIs in public subnets)
echo "[2] ALB..."
ALB_ARN=$(aws elbv2 describe-load-balancers --region "$AWS_REGION" --query "LoadBalancers[?VpcId=='$VPC_ID'].LoadBalancerArn" --output text 2>/dev/null | head -1)
if [[ -n "$ALB_ARN" ]]; then
  aws elbv2 delete-load-balancer --load-balancer-arn "$ALB_ARN" --region "$AWS_REGION" && echo "  ALB deleted"
else
  echo "  No ALB found"
fi

# 3. Delete NAT gateways (releases EIPs, unblocks IGW)
echo "[3] NAT gateways..."
for nat in $(aws ec2 describe-nat-gateways --filter "Name=vpc-id,Values=$VPC_ID" "Name=state,Values=available,pending,failed" --region "$AWS_REGION" --query 'NatGateways[*].NatGatewayId' --output text 2>/dev/null); do
  aws ec2 delete-nat-gateway --nat-gateway-id "$nat" --region "$AWS_REGION" && echo "  Deleted $nat"
done

# 4. Delete RDS if still there (releases ENI in private subnet)
echo "[4] RDS..."
for id in zinovia-fans-staging-postgres zinovia-fans-prod-postgres; do
  aws rds delete-db-instance --db-instance-identifier "$id" --skip-final-snapshot --region "$AWS_REGION" 2>/dev/null && echo "  RDS $id deleting" || true
done

echo ""
echo "Wait 5-10 min for ElastiCache/RDS/NAT to finish deleting, then run:"
echo "  cd infra/aws/terraform && terraform destroy -var-file=env/prod.tfvars -var=enable_cloudfront=false -var=db_deletion_protection=false -lock=false -auto-approve"
