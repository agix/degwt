# Overview #
degwt is a utility that de-obfuscates GWT generated javascript code. It is a [Bookmarklet](http://en.wikipedia.org/wiki/Bookmarklet), meaning you don't need to install any software to get it working.

**NOTE** : This is very much work in progress. The bookmarklet may or may not work.

# Usage #
  1. Visit any GWT enabled website - for example http://www.whirled.com/
  1. Copy/Paste the following code into your address bar (or convert it into a bookmarklet)
  1. A dialog box should show with the de-obfuscated code

```
javascript:(function(){yuiscript=document.createElement('SCRIPT');yuiscript.type='text/javascript';yuiscript.src='http://yui.yahooapis.com/2.8.0r4/build/yuiloader/yuiloader-min.js';document.getElementsByTagName('head')[0].appendChild(yuiscript);degwtscript=document.createElement('SCRIPT');degwtscript.type='text/javascript';degwtscript.src='http://degwt.googlecode.com/svn/trunk/static/js/degwt.js';document.getElementsByTagName('head')[0].appendChild(degwtscript);})();
```


# Use Cases #
  1. Penetration Testing RPC services to check for SQL Injection, authentication/authorization issues etc.
  1. Automated testing of RPC services
  1. Generating realistic test data for performance/stress testing