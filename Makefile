# Sixty Sales Dashboard - Production Deployment Makefile
# Memory-optimized deployment and monitoring commands

.PHONY: help build deploy monitor rollback test clean

# Default target
help:
	@echo "Sixty Sales Dashboard - Production Deployment Commands"
	@echo ""
	@echo "Build Commands:"
	@echo "  build-prod          Build production-optimized bundle"
	@echo "  build-analyze       Build with bundle analysis"
	@echo "  build-docker        Build Docker images with memory constraints"
	@echo ""
	@echo "Deployment Commands:"
	@echo "  deploy-production   Deploy to production with monitoring"
	@echo "  deploy-staging      Deploy to staging environment"
	@echo "  deploy-memory-opt   Deploy with aggressive memory optimization"
	@echo ""
	@echo "Monitoring Commands:"
	@echo "  monitor-deployment  Monitor deployment progress"
	@echo "  monitor-memory      Real-time memory monitoring"
	@echo "  check-resources     Check system resource usage"
	@echo "  check-health        Verify all services are healthy"
	@echo ""
	@echo "Testing Commands:"
	@echo "  test-memory         Run memory stress tests"
	@echo "  test-performance    Run performance tests"
	@echo "  test-load           Run load tests"
	@echo ""
	@echo "Emergency Commands:"
	@echo "  rollback-emergency  Emergency rollback to previous version"
	@echo "  restart-services    Restart all services"
	@echo "  cleanup-containers  Clean up stopped containers"

# Build commands
build-prod:
	@echo "🔨 Building production bundle with memory optimization..."
	NODE_OPTIONS="--max-old-space-size=2048" npm run build:prod
	@echo "✅ Production build completed"

build-analyze:
	@echo "📊 Building with bundle analysis..."
	npm run build:analyze
	@echo "✅ Bundle analysis completed - check dist/production-bundle-analysis.html"

build-docker:
	@echo "🐳 Building Docker images with memory constraints..."
	docker build --memory=2g --memory-swap=2g \
		--build-arg NODE_ENV=production \
		--build-arg VITE_BUILD_MODE=production \
		-t sixty-sales-dashboard:optimized \
		-f Dockerfile \
		--target production .
	@echo "✅ Docker images built successfully"

# Deployment commands
deploy-production: build-docker
	@echo "🚀 Deploying to production with memory monitoring..."
	
	# Pre-deployment checks
	@$(MAKE) check-resources
	
	# Deploy monitoring first
	docker-compose -f docker-compose.memory-optimized.yml up -d prometheus grafana memory-monitor
	
	# Wait for monitoring
	@echo "⏳ Waiting for monitoring services..."
	@timeout 120 bash -c 'until curl -sf http://localhost:9090/-/healthy; do sleep 5; done'
	@timeout 120 bash -c 'until curl -sf http://localhost:3000/api/health; do sleep 5; done'
	
	# Deploy application
	docker-compose -f docker-compose.memory-optimized.yml up -d
	
	# Monitor deployment
	@$(MAKE) monitor-deployment
	
	# Final health check
	@$(MAKE) check-health
	
	@echo "✅ Production deployment completed successfully"

deploy-staging:
	@echo "🧪 Deploying to staging..."
	docker-compose -f docker-compose.staging.yml up -d
	@sleep 30
	@$(MAKE) check-health
	@echo "✅ Staging deployment completed"

deploy-memory-opt:
	@echo "⚡ Deploying with aggressive memory optimization..."
	@$(MAKE) deploy-production

# Monitoring commands  
monitor-deployment:
	@echo "👀 Monitoring deployment progress..."
	@for i in $$(seq 1 60); do \
		TOTAL_MEM=$$(docker stats --no-stream --format "{{.MemUsage}}" | awk -F'/' '{sum+=$$1} END {printf "%.0f", sum}'); \
		echo "Total memory usage: $${TOTAL_MEM}MB"; \
		if [ $${TOTAL_MEM} -gt 2048 ]; then \
			echo "❌ Memory limit exceeded: $${TOTAL_MEM}MB > 2048MB"; \
			exit 1; \
		fi; \
		sleep 5; \
	done
	@echo "✅ Deployment monitoring completed"

monitor-memory:
	@echo "📊 Real-time memory monitoring..."
	@watch -n 5 'docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.CPUPerc}}"'

check-resources:
	@echo "🔍 Checking system resources..."
	@echo "Memory:"
	@free -h
	@echo ""
	@echo "Disk:"
	@df -h /
	@echo ""
	@echo "Docker:"
	@docker system df
	@echo ""
	@AVAILABLE_MEM=$$(free -m | awk 'NR==2{printf "%.1f", $$7*100/$$2}'); \
	if (( $$(echo "$$AVAILABLE_MEM < 30.0" | bc -l) )); then \
		echo "❌ Low available memory: $$AVAILABLE_MEM%"; \
		exit 1; \
	fi
	@echo "✅ System resources adequate ($$AVAILABLE_MEM% memory available)"

check-health:
	@echo "🏥 Checking service health..."
	@echo "Frontend health:"
	@curl -sf http://localhost/health || (echo "❌ Frontend unhealthy" && exit 1)
	@echo "✅ Frontend healthy"
	@echo ""
	@echo "API health:"
	@curl -sf http://localhost:8000/api/health || (echo "❌ API unhealthy" && exit 1)
	@echo "✅ API healthy"
	@echo ""
	@echo "Memory Monitor health:"
	@curl -sf http://localhost:8080/health || (echo "❌ Memory monitor unhealthy" && exit 1)
	@echo "✅ Memory monitor healthy"

# Testing commands
test-memory:
	@echo "🧠 Running memory stress tests..."
	npm run test:memory
	@echo "✅ Memory tests completed"

test-performance:
	@echo "⚡ Running performance tests..."
	npm run playwright
	@echo "✅ Performance tests completed"

test-load:
	@echo "📈 Running load tests..."
	@if command -v autocannon >/dev/null 2>&1; then \
		autocannon -c 10 -d 60 -R 50 http://localhost; \
	else \
		echo "❌ autocannon not installed. Run: npm install -g autocannon"; \
	fi

# Emergency commands
rollback-emergency:
	@echo "🚨 Performing emergency rollback..."
	docker-compose -f docker-compose.memory-optimized.yml down
	docker-compose -f docker-compose.production.yml up -d
	@sleep 30
	@$(MAKE) check-health
	@echo "✅ Emergency rollback completed"

restart-services:
	@echo "🔄 Restarting all services..."
	docker-compose -f docker-compose.memory-optimized.yml restart
	@sleep 30
	@$(MAKE) check-health
	@echo "✅ Services restarted"

cleanup-containers:
	@echo "🧹 Cleaning up containers..."
	docker system prune -f
	docker volume prune -f
	@echo "✅ Cleanup completed"

# Development helpers
dev-setup:
	@echo "🛠️  Setting up development environment..."
	npm install
	docker-compose up -d postgres redis
	@echo "✅ Development environment ready"

dev-down:
	@echo "⬇️  Stopping development environment..."
	docker-compose down
	@echo "✅ Development environment stopped"

# Utility commands
logs-api:
	@docker logs -f sixty-api-optimized

logs-nginx:
	@docker logs -f sixty-frontend-optimized

logs-memory:
	@docker logs -f sixty-memory-monitor

backup-db:
	@echo "💾 Creating database backup..."
	@mkdir -p backups
	docker exec sixty-postgres-optimized pg_dump -U postgres sixty_sales_dashboard > backups/db-backup-$$(date +%Y%m%d-%H%M%S).sql
	@echo "✅ Database backup completed"

# Memory optimization targets
MEMORY_TARGETS:
	@echo "Memory Optimization Targets:"
	@echo "  Frontend (Nginx): 128MB max"
	@echo "  API Backend: 384MB max"
	@echo "  Redis: 64MB max"
	@echo "  PostgreSQL: 512MB max"
	@echo "  Total System: 2GB max"
	@echo "  Bundle Size: 5MB max"
	@echo ""
	@echo "Performance Targets:"
	@echo "  LCP: < 2000ms"
	@echo "  FID: < 50ms"
	@echo "  CLS: < 0.05"
	@echo "  Performance Score: > 85/100"