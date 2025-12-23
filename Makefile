.PHONY: build-RequestaCloudWatchSNSSlackNotification

build-RequestaCloudWatchSNSSlackNotification:
	npm ci
	npm run build
	cp -r dist $(ARTIFACTS_DIR)/
	cp package.json $(ARTIFACTS_DIR)/
	cp package-lock.json $(ARTIFACTS_DIR)/ 2>/dev/null || true
	cd $(ARTIFACTS_DIR) && npm ci --omit=dev
