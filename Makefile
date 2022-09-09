.PHONY:all

all: dist/transacter.js dist/index.html dist/distribute.js

dist/transacter.js: src/transacter.ts 
	npx tsc
	
dist/index.html: src/index.html
	npm run copy

dist/distribte.js: src/distribute.js
	npm run build
	
format:
	npx prettier --write src
