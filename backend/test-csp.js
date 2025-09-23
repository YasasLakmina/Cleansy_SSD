// Simple test to verify CSP configuration
import { cspConfig, buildCspDirectives } from './utils/security.js';

console.log('🧪 Testing CSP Configuration...\n');

// Test 1: Check if directives are generated
const prodDirectives = buildCspDirectives(true);
const devDirectives = buildCspDirectives(false);

console.log('✅ Production directives count:', Object.keys(prodDirectives).length);
console.log('✅ Development directives count:', Object.keys(devDirectives).length);

// Test 2: Check required no-fallback directives
const requiredDirectives = ['base-uri', 'form-action', 'frame-ancestors'];
const missingDirectives = requiredDirectives.filter(dir => !prodDirectives[dir]);

if (missingDirectives.length === 0) {
  console.log('✅ All required no-fallback directives present');
} else {
  console.log('❌ Missing required directives:', missingDirectives);
}

// Test 3: Check fallback coverage
const hasScriptSrc = prodDirectives['script-src'];
const hasScriptSrcElem = prodDirectives['script-src-elem'];
const hasStyleSrc = prodDirectives['style-src'];
const hasStyleSrcElem = prodDirectives['style-src-elem'];

console.log('✅ Script fallback coverage:', hasScriptSrc && hasScriptSrcElem ? 'Valid' : 'Invalid');
console.log('✅ Style fallback coverage:', hasStyleSrc && hasStyleSrcElem ? 'Valid' : 'Invalid');

// Test 4: Check CSP config object
console.log('✅ CSP config object type:', typeof cspConfig);
console.log('✅ CSP directives type:', typeof cspConfig.contentSecurityPolicy.directives);

console.log('\n🎉 CSP Configuration Test Complete!');
