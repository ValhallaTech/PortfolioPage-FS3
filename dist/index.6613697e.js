// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles

(function (modules, entry, mainEntry, parcelRequireName, globalName) {
  /* eslint-disable no-undef */
  var globalObject =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof self !== 'undefined'
      ? self
      : typeof window !== 'undefined'
      ? window
      : typeof global !== 'undefined'
      ? global
      : {};
  /* eslint-enable no-undef */

  // Save the require from previous bundle to this closure if any
  var previousRequire =
    typeof globalObject[parcelRequireName] === 'function' &&
    globalObject[parcelRequireName];

  var cache = previousRequire.cache || {};
  // Do not use `require` to prevent Webpack from trying to bundle this call
  var nodeRequire =
    typeof module !== 'undefined' &&
    typeof module.require === 'function' &&
    module.require.bind(module);

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire =
          typeof globalObject[parcelRequireName] === 'function' &&
          globalObject[parcelRequireName];
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        // Try the node require function if it exists.
        if (nodeRequire && typeof name === 'string') {
          return nodeRequire(name);
        }

        var err = new Error("Cannot find module '" + name + "'");
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }

      localRequire.resolve = resolve;
      localRequire.cache = {};

      var module = (cache[name] = new newRequire.Module(name));

      modules[name][0].call(
        module.exports,
        localRequire,
        module,
        module.exports,
        this
      );
    }

    return cache[name].exports;

    function localRequire(x) {
      var res = localRequire.resolve(x);
      return res === false ? {} : newRequire(res);
    }

    function resolve(x) {
      var id = modules[name][1][x];
      return id != null ? id : x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.register = function (id, exports) {
    modules[id] = [
      function (require, module) {
        module.exports = exports;
      },
      {},
    ];
  };

  Object.defineProperty(newRequire, 'root', {
    get: function () {
      return globalObject[parcelRequireName];
    },
  });

  globalObject[parcelRequireName] = newRequire;

  for (var i = 0; i < entry.length; i++) {
    newRequire(entry[i]);
  }

  if (mainEntry) {
    // Expose entry point to Node, AMD or browser globals
    // Based on https://github.com/ForbesLindesay/umd/blob/master/template.js
    var mainExports = newRequire(mainEntry);

    // CommonJS
    if (typeof exports === 'object' && typeof module !== 'undefined') {
      module.exports = mainExports;

      // RequireJS
    } else if (typeof define === 'function' && define.amd) {
      define(function () {
        return mainExports;
      });

      // <script>
    } else if (globalName) {
      this[globalName] = mainExports;
    }
  }
})({"83X2x":[function(require,module,exports) {
var HMR_HOST = null;
var HMR_PORT = null;
var HMR_SECURE = false;
var HMR_ENV_HASH = "4a236f9275d0a351";
module.bundle.HMR_BUNDLE_ID = "e75801926613697e";
"use strict";
function _toConsumableArray(arr) {
    return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread();
}
function _nonIterableSpread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _iterableToArray(iter) {
    if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter);
}
function _arrayWithoutHoles(arr) {
    if (Array.isArray(arr)) return _arrayLikeToArray(arr);
}
function _createForOfIteratorHelper(o, allowArrayLike) {
    var it;
    if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) {
        if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") {
            if (it) o = it;
            var i = 0;
            var F = function F() {
            };
            return {
                s: F,
                n: function n() {
                    if (i >= o.length) return {
                        done: true
                    };
                    return {
                        done: false,
                        value: o[i++]
                    };
                },
                e: function e(_e) {
                    throw _e;
                },
                f: F
            };
        }
        throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
    }
    var normalCompletion = true, didErr = false, err;
    return {
        s: function s() {
            it = o[Symbol.iterator]();
        },
        n: function n() {
            var step = it.next();
            normalCompletion = step.done;
            return step;
        },
        e: function e(_e2) {
            didErr = true;
            err = _e2;
        },
        f: function f() {
            try {
                if (!normalCompletion && it.return != null) it.return();
            } finally{
                if (didErr) throw err;
            }
        }
    };
}
function _unsupportedIterableToArray(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _arrayLikeToArray(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(o);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
}
function _arrayLikeToArray(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
/* global HMR_HOST, HMR_PORT, HMR_ENV_HASH, HMR_SECURE */ /*::
import type {
  HMRAsset,
  HMRMessage,
} from '@parcel/reporter-dev-server/src/HMRServer.js';
interface ParcelRequire {
  (string): mixed;
  cache: {|[string]: ParcelModule|};
  hotData: mixed;
  Module: any;
  parent: ?ParcelRequire;
  isParcelRequire: true;
  modules: {|[string]: [Function, {|[string]: string|}]|};
  HMR_BUNDLE_ID: string;
  root: ParcelRequire;
}
interface ParcelModule {
  hot: {|
    data: mixed,
    accept(cb: (Function) => void): void,
    dispose(cb: (mixed) => void): void,
    // accept(deps: Array<string> | string, cb: (Function) => void): void,
    // decline(): void,
    _acceptCallbacks: Array<(Function) => void>,
    _disposeCallbacks: Array<(mixed) => void>,
  |};
}
declare var module: {bundle: ParcelRequire, ...};
declare var HMR_HOST: string;
declare var HMR_PORT: string;
declare var HMR_ENV_HASH: string;
declare var HMR_SECURE: boolean;
*/ var OVERLAY_ID = '__parcel__error__overlay__';
var OldModule = module.bundle.Module;
function Module(moduleName) {
    OldModule.call(this, moduleName);
    this.hot = {
        data: module.bundle.hotData,
        _acceptCallbacks: [],
        _disposeCallbacks: [],
        accept: function accept(fn) {
            this._acceptCallbacks.push(fn || function() {
            });
        },
        dispose: function dispose(fn) {
            this._disposeCallbacks.push(fn);
        }
    };
    module.bundle.hotData = undefined;
}
module.bundle.Module = Module;
var checkedAssets, acceptedAssets, assetsToAccept;
function getHostname() {
    return HMR_HOST || (location.protocol.indexOf('http') === 0 ? location.hostname : 'localhost');
}
function getPort() {
    return HMR_PORT || location.port;
} // eslint-disable-next-line no-redeclare
var parent = module.bundle.parent;
if ((!parent || !parent.isParcelRequire) && typeof WebSocket !== 'undefined') {
    var hostname = getHostname();
    var port = getPort();
    var protocol = HMR_SECURE || location.protocol == 'https:' && !/localhost|127.0.0.1|0.0.0.0/.test(hostname) ? 'wss' : 'ws';
    var ws = new WebSocket(protocol + '://' + hostname + (port ? ':' + port : '') + '/'); // $FlowFixMe
    ws.onmessage = function(event) {
        checkedAssets = {
        };
        acceptedAssets = {
        };
        assetsToAccept = [];
        var data = JSON.parse(event.data);
        if (data.type === 'update') {
            // Remove error overlay if there is one
            if (typeof document !== 'undefined') removeErrorOverlay();
            var assets = data.assets.filter(function(asset) {
                return asset.envHash === HMR_ENV_HASH;
            }); // Handle HMR Update
            var handled = assets.every(function(asset) {
                return asset.type === 'css' || asset.type === 'js' && hmrAcceptCheck(module.bundle.root, asset.id, asset.depsByBundle);
            });
            if (handled) {
                console.clear();
                assets.forEach(function(asset) {
                    hmrApply(module.bundle.root, asset);
                });
                for(var i = 0; i < assetsToAccept.length; i++){
                    var id = assetsToAccept[i][1];
                    if (!acceptedAssets[id]) hmrAcceptRun(assetsToAccept[i][0], id);
                }
            } else window.location.reload();
        }
        if (data.type === 'error') {
            // Log parcel errors to console
            var _iterator = _createForOfIteratorHelper(data.diagnostics.ansi), _step;
            try {
                for(_iterator.s(); !(_step = _iterator.n()).done;){
                    var ansiDiagnostic = _step.value;
                    var stack = ansiDiagnostic.codeframe ? ansiDiagnostic.codeframe : ansiDiagnostic.stack;
                    console.error('🚨 [parcel]: ' + ansiDiagnostic.message + '\n' + stack + '\n\n' + ansiDiagnostic.hints.join('\n'));
                }
            } catch (err) {
                _iterator.e(err);
            } finally{
                _iterator.f();
            }
            if (typeof document !== 'undefined') {
                // Render the fancy html overlay
                removeErrorOverlay();
                var overlay = createErrorOverlay(data.diagnostics.html); // $FlowFixMe
                document.body.appendChild(overlay);
            }
        }
    };
    ws.onerror = function(e) {
        console.error(e.message);
    };
    ws.onclose = function() {
        console.warn('[parcel] 🚨 Connection to the HMR server was lost');
    };
}
function removeErrorOverlay() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
        overlay.remove();
        console.log('[parcel] ✨ Error resolved');
    }
}
function createErrorOverlay(diagnostics) {
    var overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    var errorHTML = '<div style="background: black; opacity: 0.85; font-size: 16px; color: white; position: fixed; height: 100%; width: 100%; top: 0px; left: 0px; padding: 30px; font-family: Menlo, Consolas, monospace; z-index: 9999;">';
    var _iterator2 = _createForOfIteratorHelper(diagnostics), _step2;
    try {
        for(_iterator2.s(); !(_step2 = _iterator2.n()).done;){
            var diagnostic = _step2.value;
            var stack = diagnostic.codeframe ? diagnostic.codeframe : diagnostic.stack;
            errorHTML += "\n      <div>\n        <div style=\"font-size: 18px; font-weight: bold; margin-top: 20px;\">\n          \uD83D\uDEA8 ".concat(diagnostic.message, "\n        </div>\n        <pre>").concat(stack, "</pre>\n        <div>\n          ").concat(diagnostic.hints.map(function(hint) {
                return '<div>💡 ' + hint + '</div>';
            }).join(''), "\n        </div>\n        ").concat(diagnostic.documentation ? "<div>\uD83D\uDCDD <a style=\"color: violet\" href=\"".concat(diagnostic.documentation, "\" target=\"_blank\">Learn more</a></div>") : '', "\n      </div>\n    ");
        }
    } catch (err) {
        _iterator2.e(err);
    } finally{
        _iterator2.f();
    }
    errorHTML += '</div>';
    overlay.innerHTML = errorHTML;
    return overlay;
}
function getParents(bundle, id) /*: Array<[ParcelRequire, string]> */ {
    var modules = bundle.modules;
    if (!modules) return [];
    var parents = [];
    var k, d, dep;
    for(k in modules)for(d in modules[k][1]){
        dep = modules[k][1][d];
        if (dep === id || Array.isArray(dep) && dep[dep.length - 1] === id) parents.push([
            bundle,
            k
        ]);
    }
    if (bundle.parent) parents = parents.concat(getParents(bundle.parent, id));
    return parents;
}
function updateLink(link) {
    var newLink = link.cloneNode();
    newLink.onload = function() {
        if (link.parentNode !== null) // $FlowFixMe
        link.parentNode.removeChild(link);
    };
    newLink.setAttribute('href', link.getAttribute('href').split('?')[0] + '?' + Date.now()); // $FlowFixMe
    link.parentNode.insertBefore(newLink, link.nextSibling);
}
var cssTimeout = null;
function reloadCSS() {
    if (cssTimeout) return;
    cssTimeout = setTimeout(function() {
        var links = document.querySelectorAll('link[rel="stylesheet"]');
        for(var i = 0; i < links.length; i++){
            // $FlowFixMe[incompatible-type]
            var href = links[i].getAttribute('href');
            var hostname = getHostname();
            var servedFromHMRServer = hostname === 'localhost' ? new RegExp('^(https?:\\/\\/(0.0.0.0|127.0.0.1)|localhost):' + getPort()).test(href) : href.indexOf(hostname + ':' + getPort());
            var absolute = /^https?:\/\//i.test(href) && href.indexOf(window.location.origin) !== 0 && !servedFromHMRServer;
            if (!absolute) updateLink(links[i]);
        }
        cssTimeout = null;
    }, 50);
}
function hmrApply(bundle, asset) {
    var modules = bundle.modules;
    if (!modules) return;
    if (asset.type === 'css') reloadCSS();
    else if (asset.type === 'js') {
        var deps = asset.depsByBundle[bundle.HMR_BUNDLE_ID];
        if (deps) {
            if (modules[asset.id]) {
                // Remove dependencies that are removed and will become orphaned.
                // This is necessary so that if the asset is added back again, the cache is gone, and we prevent a full page reload.
                var oldDeps = modules[asset.id][1];
                for(var dep in oldDeps)if (!deps[dep] || deps[dep] !== oldDeps[dep]) {
                    var id = oldDeps[dep];
                    var parents = getParents(module.bundle.root, id);
                    if (parents.length === 1) hmrDelete(module.bundle.root, id);
                }
            }
            var fn = new Function('require', 'module', 'exports', asset.output);
            modules[asset.id] = [
                fn,
                deps
            ];
        } else if (bundle.parent) hmrApply(bundle.parent, asset);
    }
}
function hmrDelete(bundle, id1) {
    var modules = bundle.modules;
    if (!modules) return;
    if (modules[id1]) {
        // Collect dependencies that will become orphaned when this module is deleted.
        var deps = modules[id1][1];
        var orphans = [];
        for(var dep in deps){
            var parents = getParents(module.bundle.root, deps[dep]);
            if (parents.length === 1) orphans.push(deps[dep]);
        } // Delete the module. This must be done before deleting dependencies in case of circular dependencies.
        delete modules[id1];
        delete bundle.cache[id1]; // Now delete the orphans.
        orphans.forEach(function(id) {
            hmrDelete(module.bundle.root, id);
        });
    } else if (bundle.parent) hmrDelete(bundle.parent, id1);
}
function hmrAcceptCheck(bundle, id, depsByBundle) {
    if (hmrAcceptCheckOne(bundle, id, depsByBundle)) return true;
     // Traverse parents breadth first. All possible ancestries must accept the HMR update, or we'll reload.
    var parents = getParents(module.bundle.root, id);
    var accepted = false;
    while(parents.length > 0){
        var v = parents.shift();
        var a = hmrAcceptCheckOne(v[0], v[1], null);
        if (a) // If this parent accepts, stop traversing upward, but still consider siblings.
        accepted = true;
        else {
            // Otherwise, queue the parents in the next level upward.
            var p = getParents(module.bundle.root, v[1]);
            if (p.length === 0) {
                // If there are no parents, then we've reached an entry without accepting. Reload.
                accepted = false;
                break;
            }
            parents.push.apply(parents, _toConsumableArray(p));
        }
    }
    return accepted;
}
function hmrAcceptCheckOne(bundle, id, depsByBundle) {
    var modules = bundle.modules;
    if (!modules) return;
    if (depsByBundle && !depsByBundle[bundle.HMR_BUNDLE_ID]) {
        // If we reached the root bundle without finding where the asset should go,
        // there's nothing to do. Mark as "accepted" so we don't reload the page.
        if (!bundle.parent) return true;
        return hmrAcceptCheck(bundle.parent, id, depsByBundle);
    }
    if (checkedAssets[id]) return true;
    checkedAssets[id] = true;
    var cached = bundle.cache[id];
    assetsToAccept.push([
        bundle,
        id
    ]);
    if (!cached || cached.hot && cached.hot._acceptCallbacks.length) return true;
}
function hmrAcceptRun(bundle, id) {
    var cached = bundle.cache[id];
    bundle.hotData = {
    };
    if (cached && cached.hot) cached.hot.data = bundle.hotData;
    if (cached && cached.hot && cached.hot._disposeCallbacks.length) cached.hot._disposeCallbacks.forEach(function(cb) {
        cb(bundle.hotData);
    });
    delete bundle.cache[id];
    bundle(id);
    cached = bundle.cache[id];
    if (cached && cached.hot && cached.hot._acceptCallbacks.length) cached.hot._acceptCallbacks.forEach(function(cb) {
        var assetsToAlsoAccept = cb(function() {
            return getParents(module.bundle.root, id);
        });
        if (assetsToAlsoAccept && assetsToAccept.length) // $FlowFixMe[method-unbinding]
        assetsToAccept.push.apply(assetsToAccept, assetsToAlsoAccept);
    });
    acceptedAssets[id] = true;
}

},{}],"cfYPf":[function(require,module,exports) {
/*!
 * 
 *   typed.js - A JavaScript Typing Animation Library
 *   Author: Matt Boldt <me@mattboldt.com>
 *   Version: v2.0.12
 *   Url: https://github.com/mattboldt/typed.js
 *   License(s): MIT
 * 
 */ (function(t, e) {
    "object" == typeof exports && "object" == typeof module ? module.exports = e() : "function" == typeof define && define.amd ? define([], e) : "object" == typeof exports ? exports.Typed = e() : t.Typed = e();
})(this, function() {
    return (function(t) {
        function e(n) {
            if (s[n]) return s[n].exports;
            var i = s[n] = {
                exports: {
                },
                id: n,
                loaded: !1
            };
            return t[n].call(i.exports, i, i.exports, e), i.loaded = !0, i.exports;
        }
        var s = {
        };
        return e.m = t, e.c = s, e.p = "", e(0);
    })([
        function(t1, e1, s1) {
            "use strict";
            function n1(t, e) {
                if (!(t instanceof e)) throw new TypeError("Cannot call a class as a function");
            }
            Object.defineProperty(e1, "__esModule", {
                value: !0
            });
            var i1 = function() {
                function t2(t, e) {
                    for(var s = 0; s < e.length; s++){
                        var n = e[s];
                        n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(t, n.key, n);
                    }
                }
                return function(e, s, n) {
                    return s && t2(e.prototype, s), n && t2(e, n), e;
                };
            }(), r1 = s1(1), o = s1(3), a1 = function() {
                function t3(e, s) {
                    n1(this, t3), r1.initializer.load(this, s, e), this.begin();
                }
                return i1(t3, [
                    {
                        key: "toggle",
                        value: function() {
                            this.pause.status ? this.start() : this.stop();
                        }
                    },
                    {
                        key: "stop",
                        value: function() {
                            this.typingComplete || this.pause.status || (this.toggleBlinking(!0), this.pause.status = !0, this.options.onStop(this.arrayPos, this));
                        }
                    },
                    {
                        key: "start",
                        value: function() {
                            this.typingComplete || this.pause.status && (this.pause.status = !1, this.pause.typewrite ? this.typewrite(this.pause.curString, this.pause.curStrPos) : this.backspace(this.pause.curString, this.pause.curStrPos), this.options.onStart(this.arrayPos, this));
                        }
                    },
                    {
                        key: "destroy",
                        value: function() {
                            this.reset(!1), this.options.onDestroy(this);
                        }
                    },
                    {
                        key: "reset",
                        value: function() {
                            var t = arguments.length <= 0 || void 0 === arguments[0] || arguments[0];
                            clearInterval(this.timeout), this.replaceText(""), this.cursor && this.cursor.parentNode && (this.cursor.parentNode.removeChild(this.cursor), this.cursor = null), this.strPos = 0, this.arrayPos = 0, this.curLoop = 0, t && (this.insertCursor(), this.options.onReset(this), this.begin());
                        }
                    },
                    {
                        key: "begin",
                        value: function() {
                            var t = this;
                            this.options.onBegin(this), this.typingComplete = !1, this.shuffleStringsIfNeeded(this), this.insertCursor(), this.bindInputFocusEvents && this.bindFocusEvents(), this.timeout = setTimeout(function() {
                                t.currentElContent && 0 !== t.currentElContent.length ? t.backspace(t.currentElContent, t.currentElContent.length) : t.typewrite(t.strings[t.sequence[t.arrayPos]], t.strPos);
                            }, this.startDelay);
                        }
                    },
                    {
                        key: "typewrite",
                        value: function(t, e) {
                            var s = this;
                            this.fadeOut && this.el.classList.contains(this.fadeOutClass) && (this.el.classList.remove(this.fadeOutClass), this.cursor && this.cursor.classList.remove(this.fadeOutClass));
                            var n2 = this.humanizer(this.typeSpeed), i = 1;
                            return this.pause.status === !0 ? void this.setPauseStatus(t, e, !0) : void (this.timeout = setTimeout(function() {
                                e = o.htmlParser.typeHtmlChars(t, e, s);
                                var n = 0, r = t.substr(e);
                                if ("^" === r.charAt(0) && /^\^\d+/.test(r)) {
                                    var a = 1;
                                    r = /\d+/.exec(r)[0], a += r.length, n = parseInt(r), s.temporaryPause = !0, s.options.onTypingPaused(s.arrayPos, s), t = t.substring(0, e) + t.substring(e + a), s.toggleBlinking(!0);
                                }
                                if ("`" === r.charAt(0)) {
                                    for(; "`" !== t.substr(e + i).charAt(0) && (i++, !(e + i > t.length)););
                                    var u = t.substring(0, e), l = t.substring(u.length + 1, e + i), c = t.substring(e + i + 1);
                                    t = u + l + c, i--;
                                }
                                s.timeout = setTimeout(function() {
                                    s.toggleBlinking(!1), e >= t.length ? s.doneTyping(t, e) : s.keepTyping(t, e, i), s.temporaryPause && (s.temporaryPause = !1, s.options.onTypingResumed(s.arrayPos, s));
                                }, n);
                            }, n2));
                        }
                    },
                    {
                        key: "keepTyping",
                        value: function(t, e, s) {
                            0 === e && (this.toggleBlinking(!1), this.options.preStringTyped(this.arrayPos, this)), e += s;
                            var n = t.substr(0, e);
                            this.replaceText(n), this.typewrite(t, e);
                        }
                    },
                    {
                        key: "doneTyping",
                        value: function(t, e) {
                            var s = this;
                            this.options.onStringTyped(this.arrayPos, this), this.toggleBlinking(!0), this.arrayPos === this.strings.length - 1 && (this.complete(), this.loop === !1 || this.curLoop === this.loopCount) || (this.timeout = setTimeout(function() {
                                s.backspace(t, e);
                            }, this.backDelay));
                        }
                    },
                    {
                        key: "backspace",
                        value: function(t, e) {
                            var s = this;
                            if (this.pause.status === !0) return void this.setPauseStatus(t, e, !1);
                            if (this.fadeOut) return this.initFadeOut();
                            this.toggleBlinking(!1);
                            var n3 = this.humanizer(this.backSpeed);
                            this.timeout = setTimeout(function() {
                                e = o.htmlParser.backSpaceHtmlChars(t, e, s);
                                var n = t.substr(0, e);
                                if (s.replaceText(n), s.smartBackspace) {
                                    var i = s.strings[s.arrayPos + 1];
                                    i && n === i.substr(0, e) ? s.stopNum = e : s.stopNum = 0;
                                }
                                e > s.stopNum ? (e--, s.backspace(t, e)) : e <= s.stopNum && (s.arrayPos++, s.arrayPos === s.strings.length ? (s.arrayPos = 0, s.options.onLastStringBackspaced(), s.shuffleStringsIfNeeded(), s.begin()) : s.typewrite(s.strings[s.sequence[s.arrayPos]], e));
                            }, n3);
                        }
                    },
                    {
                        key: "complete",
                        value: function() {
                            this.options.onComplete(this), this.loop ? this.curLoop++ : this.typingComplete = !0;
                        }
                    },
                    {
                        key: "setPauseStatus",
                        value: function(t, e, s) {
                            this.pause.typewrite = s, this.pause.curString = t, this.pause.curStrPos = e;
                        }
                    },
                    {
                        key: "toggleBlinking",
                        value: function(t) {
                            this.cursor && (this.pause.status || this.cursorBlinking !== t && (this.cursorBlinking = t, t ? this.cursor.classList.add("typed-cursor--blink") : this.cursor.classList.remove("typed-cursor--blink")));
                        }
                    },
                    {
                        key: "humanizer",
                        value: function(t) {
                            return Math.round(Math.random() * t / 2) + t;
                        }
                    },
                    {
                        key: "shuffleStringsIfNeeded",
                        value: function() {
                            this.shuffle && (this.sequence = this.sequence.sort(function() {
                                return Math.random() - 0.5;
                            }));
                        }
                    },
                    {
                        key: "initFadeOut",
                        value: function() {
                            var t = this;
                            return this.el.className += " " + this.fadeOutClass, this.cursor && (this.cursor.className += " " + this.fadeOutClass), setTimeout(function() {
                                t.arrayPos++, t.replaceText(""), t.strings.length > t.arrayPos ? t.typewrite(t.strings[t.sequence[t.arrayPos]], 0) : (t.typewrite(t.strings[0], 0), t.arrayPos = 0);
                            }, this.fadeOutDelay);
                        }
                    },
                    {
                        key: "replaceText",
                        value: function(t) {
                            this.attr ? this.el.setAttribute(this.attr, t) : this.isInput ? this.el.value = t : "html" === this.contentType ? this.el.innerHTML = t : this.el.textContent = t;
                        }
                    },
                    {
                        key: "bindFocusEvents",
                        value: function() {
                            var t = this;
                            this.isInput && (this.el.addEventListener("focus", function(e) {
                                t.stop();
                            }), this.el.addEventListener("blur", function(e) {
                                t.el.value && 0 !== t.el.value.length || t.start();
                            }));
                        }
                    },
                    {
                        key: "insertCursor",
                        value: function() {
                            this.showCursor && (this.cursor || (this.cursor = document.createElement("span"), this.cursor.className = "typed-cursor", this.cursor.setAttribute("aria-hidden", !0), this.cursor.innerHTML = this.cursorChar, this.el.parentNode && this.el.parentNode.insertBefore(this.cursor, this.el.nextSibling)));
                        }
                    }
                ]), t3;
            }();
            e1["default"] = a1, t1.exports = e1["default"];
        },
        function(t4, e2, s2) {
            "use strict";
            function n4(t) {
                return t && t.__esModule ? t : {
                    "default": t
                };
            }
            function i2(t, e) {
                if (!(t instanceof e)) throw new TypeError("Cannot call a class as a function");
            }
            Object.defineProperty(e2, "__esModule", {
                value: !0
            });
            var r = Object.assign || function(t) {
                for(var e = 1; e < arguments.length; e++){
                    var s = arguments[e];
                    for(var n in s)Object.prototype.hasOwnProperty.call(s, n) && (t[n] = s[n]);
                }
                return t;
            }, o1 = function() {
                function t5(t, e) {
                    for(var s = 0; s < e.length; s++){
                        var n = e[s];
                        n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(t, n.key, n);
                    }
                }
                return function(e, s, n) {
                    return s && t5(e.prototype, s), n && t5(e, n), e;
                };
            }(), a2 = s2(2), u = n4(a2), l = function() {
                function t6() {
                    i2(this, t6);
                }
                return o1(t6, [
                    {
                        key: "load",
                        value: function(t7, e, s) {
                            if ("string" == typeof s ? t7.el = document.querySelector(s) : t7.el = s, t7.options = r({
                            }, u["default"], e), t7.isInput = "input" === t7.el.tagName.toLowerCase(), t7.attr = t7.options.attr, t7.bindInputFocusEvents = t7.options.bindInputFocusEvents, t7.showCursor = !t7.isInput && t7.options.showCursor, t7.cursorChar = t7.options.cursorChar, t7.cursorBlinking = !0, t7.elContent = t7.attr ? t7.el.getAttribute(t7.attr) : t7.el.textContent, t7.contentType = t7.options.contentType, t7.typeSpeed = t7.options.typeSpeed, t7.startDelay = t7.options.startDelay, t7.backSpeed = t7.options.backSpeed, t7.smartBackspace = t7.options.smartBackspace, t7.backDelay = t7.options.backDelay, t7.fadeOut = t7.options.fadeOut, t7.fadeOutClass = t7.options.fadeOutClass, t7.fadeOutDelay = t7.options.fadeOutDelay, t7.isPaused = !1, t7.strings = t7.options.strings.map(function(t) {
                                return t.trim();
                            }), "string" == typeof t7.options.stringsElement ? t7.stringsElement = document.querySelector(t7.options.stringsElement) : t7.stringsElement = t7.options.stringsElement, t7.stringsElement) {
                                t7.strings = [], t7.stringsElement.style.display = "none";
                                var n = Array.prototype.slice.apply(t7.stringsElement.children), i = n.length;
                                if (i) for(var o = 0; o < i; o += 1){
                                    var a = n[o];
                                    t7.strings.push(a.innerHTML.trim());
                                }
                            }
                            t7.strPos = 0, t7.arrayPos = 0, t7.stopNum = 0, t7.loop = t7.options.loop, t7.loopCount = t7.options.loopCount, t7.curLoop = 0, t7.shuffle = t7.options.shuffle, t7.sequence = [], t7.pause = {
                                status: !1,
                                typewrite: !0,
                                curString: "",
                                curStrPos: 0
                            }, t7.typingComplete = !1;
                            for(var o in t7.strings)t7.sequence[o] = o;
                            t7.currentElContent = this.getCurrentElContent(t7), t7.autoInsertCss = t7.options.autoInsertCss, this.appendAnimationCss(t7);
                        }
                    },
                    {
                        key: "getCurrentElContent",
                        value: function(t) {
                            var e = "";
                            return e = t.attr ? t.el.getAttribute(t.attr) : t.isInput ? t.el.value : "html" === t.contentType ? t.el.innerHTML : t.el.textContent;
                        }
                    },
                    {
                        key: "appendAnimationCss",
                        value: function(t) {
                            var e = "data-typed-js-css";
                            if (t.autoInsertCss && (t.showCursor || t.fadeOut) && !document.querySelector("[" + e + "]")) {
                                var s = document.createElement("style");
                                s.type = "text/css", s.setAttribute(e, !0);
                                var n = "";
                                t.showCursor && (n += "\n        .typed-cursor{\n          opacity: 1;\n        }\n        .typed-cursor.typed-cursor--blink{\n          animation: typedjsBlink 0.7s infinite;\n          -webkit-animation: typedjsBlink 0.7s infinite;\n                  animation: typedjsBlink 0.7s infinite;\n        }\n        @keyframes typedjsBlink{\n          50% { opacity: 0.0; }\n        }\n        @-webkit-keyframes typedjsBlink{\n          0% { opacity: 1; }\n          50% { opacity: 0.0; }\n          100% { opacity: 1; }\n        }\n      "), t.fadeOut && (n += "\n        .typed-fade-out{\n          opacity: 0;\n          transition: opacity .25s;\n        }\n        .typed-cursor.typed-cursor--blink.typed-fade-out{\n          -webkit-animation: 0;\n          animation: 0;\n        }\n      "), 0 !== s.length && (s.innerHTML = n, document.body.appendChild(s));
                            }
                        }
                    }
                ]), t6;
            }();
            e2["default"] = l;
            var c = new l;
            e2.initializer = c;
        },
        function(t, e) {
            "use strict";
            Object.defineProperty(e, "__esModule", {
                value: !0
            });
            var s = {
                strings: [
                    "These are the default values...",
                    "You know what you should do?",
                    "Use your own!",
                    "Have a great day!"
                ],
                stringsElement: null,
                typeSpeed: 0,
                startDelay: 0,
                backSpeed: 0,
                smartBackspace: !0,
                shuffle: !1,
                backDelay: 700,
                fadeOut: !1,
                fadeOutClass: "typed-fade-out",
                fadeOutDelay: 500,
                loop: !1,
                loopCount: 1 / 0,
                showCursor: !0,
                cursorChar: "|",
                autoInsertCss: !0,
                attr: null,
                bindInputFocusEvents: !1,
                contentType: "html",
                onBegin: function(t) {
                },
                onComplete: function(t) {
                },
                preStringTyped: function(t, e) {
                },
                onStringTyped: function(t, e) {
                },
                onLastStringBackspaced: function(t) {
                },
                onTypingPaused: function(t, e) {
                },
                onTypingResumed: function(t, e) {
                },
                onReset: function(t) {
                },
                onStop: function(t, e) {
                },
                onStart: function(t, e) {
                },
                onDestroy: function(t) {
                }
            };
            e["default"] = s, t.exports = e["default"];
        },
        function(t8, e3) {
            "use strict";
            function s3(t, e) {
                if (!(t instanceof e)) throw new TypeError("Cannot call a class as a function");
            }
            Object.defineProperty(e3, "__esModule", {
                value: !0
            });
            var n5 = function() {
                function t9(t, e) {
                    for(var s = 0; s < e.length; s++){
                        var n = e[s];
                        n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(t, n.key, n);
                    }
                }
                return function(e, s, n) {
                    return s && t9(e.prototype, s), n && t9(e, n), e;
                };
            }(), i3 = function() {
                function t10() {
                    s3(this, t10);
                }
                return n5(t10, [
                    {
                        key: "typeHtmlChars",
                        value: function(t, e, s) {
                            if ("html" !== s.contentType) return e;
                            var n = t.substr(e).charAt(0);
                            if ("<" === n || "&" === n) {
                                var i = "";
                                for(i = "<" === n ? ">" : ";"; t.substr(e + 1).charAt(0) !== i && (e++, !(e + 1 > t.length)););
                                e++;
                            }
                            return e;
                        }
                    },
                    {
                        key: "backSpaceHtmlChars",
                        value: function(t, e, s) {
                            if ("html" !== s.contentType) return e;
                            var n = t.substr(e).charAt(0);
                            if (">" === n || ";" === n) {
                                var i = "";
                                for(i = ">" === n ? "<" : "&"; t.substr(e - 1).charAt(0) !== i && (e--, !(e < 0)););
                                e--;
                            }
                            return e;
                        }
                    }
                ]), t10;
            }();
            e3["default"] = i3;
            var r = new i3;
            e3.htmlParser = r;
        }
    ]);
});

},{}]},["83X2x","cfYPf"], "cfYPf", "parcelRequire7d9b")

//# sourceMappingURL=index.6613697e.js.map
