.PHONY:all

all: dist/transacter.js dist/index.html dist/distribute.js

dist/transacter.js: src/transacter.js 
	npm run copy
	
dist/index.html: src/index.html
	npm run copy

dist/distribte.js: src/distribute.js
	npm run build
	