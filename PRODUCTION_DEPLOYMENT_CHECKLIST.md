# Production Deployment Checklist - Memory Optimized

## Pre-Deployment Requirements

### Build Optimization ✅
- [ ] Bundle size under 5MB limit
- [ ] Tree shaking enabled
- [ ] Code splitting configured
- [ ] Dead code elimination active
- [ ] Minification with Terser
- [ ] Source maps disabled in production
- [ ] CSS optimization enabled

### Memory Configuration ✅
- [ ] Node.js max memory: 384MB (API)
- [ ] Nginx memory limit: 128MB
- [ ] Redis memory limit: 64MB
- [ ] PostgreSQL memory: 512MB
- [ ] Total system memory: < 2GB

### Container Resources ✅
- [ ] Docker memory limits set
- [ ] CPU limits configured
- [ ] Health checks implemented
- [ ] Restart policies defined
- [ ] Security contexts applied

### Monitoring Setup ✅
- [ ] Prometheus configured
- [ ] Grafana dashboards ready
- [ ] Memory alerts configured
- [ ] Performance thresholds set
- [ ] Log aggregation active

## Deployment Process

### 1. Pre-Deployment Validation
```bash
# Check current system resources
free -m
df -h

# Verify Docker is running
docker --version
docker info

# Check available memory
echo "Available memory: $(free -m | awk 'NR==2{printf "%.1f%%", $7*100/$2 }')"
```

### 2. Build and Test
```bash
# Build with memory constraints
NODE_OPTIONS="--max-old-space-size=2048" npm run build:prod

# Verify bundle size
BUNDLE_SIZE=$(du -sm dist/ | cut -f1)
if [ $BUNDLE_SIZE -gt 5 ]; then
  echo "❌ Bundle size ${BUNDLE_SIZE}MB exceeds 5MB limit"
  exit 1
fi

# Test container memory usage
docker build -t sixty-test .
docker run -d --name test --memory=256m --memory-swap=256m sixty-test
sleep 30
MEMORY_USAGE=$(docker stats test --no-stream --format "{{.MemPerc}}" | sed 's/%//')
docker rm -f test

if (( $(echo "$MEMORY_USAGE > 80" | bc -l) )); then
  echo "❌ Container memory usage ${MEMORY_USAGE}% too high"
  exit 1
fi
```

### 3. Deploy with Memory Monitoring
```bash
# Deploy monitoring first
docker-compose -f docker-compose.memory-optimized.yml up -d prometheus grafana memory-monitor

# Wait for monitoring
timeout 120 bash -c 'until curl -f http://localhost:9090/-/healthy; do sleep 5; done'

# Deploy application
docker-compose -f docker-compose.memory-optimized.yml up -d

# Monitor deployment
for i in {1..60}; do
  TOTAL_MEMORY=$(docker stats --no-stream --format "{{.MemUsage}}" | awk -F'/' '{sum+=$1} END {print sum}')
  echo "Total memory: ${TOTAL_MEMORY}MB"
  if [ $TOTAL_MEMORY -gt 2048 ]; then
    echo "❌ Memory limit exceeded"
    exit 1
  fi
  sleep 5
done
```

### 4. Health Validation
```bash
# Application health checks
curl -f http://localhost/health || exit 1
curl -f http://localhost/api/health || exit 1

# Memory validation
API_MEM=$(docker stats sixty-api-optimized --no-stream --format "{{.MemUsage}}" | sed 's/MiB.*//')
NGINX_MEM=$(docker stats sixty-frontend-optimized --no-stream --format "{{.MemUsage}}" | sed 's/MiB.*//')

echo "Memory usage: API=${API_MEM}MB, Nginx=${NGINX_MEM}MB"

[ $API_MEM -lt 320 ] && [ $NGINX_MEM -lt 100 ] || exit 1
```

### 5. Performance Verification
```bash
# Lighthouse performance check
npx lighthouse http://localhost \
  --only-categories=performance \
  --chrome-flags="--headless" \
  --output=json \
  --output-path=perf-check.json

PERF_SCORE=$(node -pe "Math.round(JSON.parse(require('fs').readFileSync('perf-check.json')).categories.performance.score * 100)")

echo "Performance score: ${PERF_SCORE}/100"
[ $PERF_SCORE -ge 85 ] || exit 1
```

## Post-Deployment Monitoring

### Memory Alerts Configuration
- **Warning**: 80% memory usage
- **Critical**: 90% memory usage
- **Container limits**: Enforce strict limits
- **System monitoring**: 24/7 monitoring active

### Performance Thresholds
- **LCP**: < 2000ms
- **FID**: < 50ms  
- **CLS**: < 0.05
- **TTI**: < 3000ms

### Monitoring Endpoints
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000
- Memory Monitor: http://localhost:8080
- Application: http://localhost

## Rollback Procedure

### Automatic Rollback Triggers
- Memory usage > 90% for 2 minutes
- Performance degradation > 20%
- Health check failures > 3 consecutive
- Container restart loops

### Manual Rollback
```bash
# Emergency rollback
docker-compose -f docker-compose.memory-optimized.yml down
docker-compose -f docker-compose.production.yml up -d

# Verify rollback
sleep 30
curl -f http://localhost/health || exit 1
```

## Memory Optimization Features

### Frontend Optimizations
- **Ultra-granular chunking**: Micro-bundling strategy
- **Lazy loading**: Components loaded on demand
- **Service Worker**: Aggressive caching
- **Image optimization**: WebP/AVIF with fallbacks
- **CSS optimization**: Critical CSS inlining

### Backend Optimizations
- **Connection pooling**: Limited to 5 connections
- **Memory limits**: Node.js heap size restricted
- **Garbage collection**: Frequent GC cycles
- **Cache management**: LRU with size limits
- **Query optimization**: Indexed queries only

### Infrastructure Optimizations
- **Container limits**: Hard memory limits enforced
- **tmpfs caching**: In-memory cache storage
- **Resource monitoring**: Real-time alerting
- **Auto-scaling**: Memory-based scaling rules

## Emergency Contacts

- **DevOps Team**: devops@company.com
- **Slack Channel**: #production-alerts
- **On-Call**: +1-XXX-XXX-XXXX
- **Monitoring**: Grafana alerts configured

## Success Metrics

### Memory Efficiency
- ✅ Total system memory < 2GB
- ✅ API backend < 384MB
- ✅ Frontend < 128MB
- ✅ Zero memory leaks detected

### Performance Targets
- ✅ Bundle size < 5MB
- ✅ Load time < 2s
- ✅ Performance score > 85/100
- ✅ Memory alerts = 0

### Operational Excellence
- ✅ Zero-downtime deployment
- ✅ Automated monitoring
- ✅ Instant rollback capability
- ✅ 24/7 health monitoring

---

## Deployment Commands Quick Reference

```bash
# Full deployment
make deploy-production

# Memory-optimized deployment
docker-compose -f docker-compose.memory-optimized.yml up -d

# Monitor deployment
make monitor-deployment

# Emergency rollback
make rollback-emergency

# Check system resources
make check-resources
```

**Last Updated**: $(date)
**Version**: 1.0.0
**Environment**: Production
**Memory Profile**: Optimized