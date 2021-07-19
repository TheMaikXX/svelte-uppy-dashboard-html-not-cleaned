
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.30.1' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /** Virtual DOM Node */
    function VNode() {}

    /** Global options
     *	@public
     *	@namespace options {Object}
     */
    var options = {

    	/** If `true`, `prop` changes trigger synchronous component updates.
      *	@name syncComponentUpdates
      *	@type Boolean
      *	@default true
      */
    	//syncComponentUpdates: true,

    	/** Processes all created VNodes.
      *	@param {VNode} vnode	A newly-created VNode to normalize/process
      */
    	//vnode(vnode) { }

    	/** Hook invoked after a component is mounted. */
    	// afterMount(component) { }

    	/** Hook invoked after the DOM is updated with a component's latest render. */
    	// afterUpdate(component) { }

    	/** Hook invoked immediately before a component is unmounted. */
    	// beforeUnmount(component) { }
    };

    var stack = [];

    var EMPTY_CHILDREN = [];

    /**
     * JSX/hyperscript reviver.
     * @see http://jasonformat.com/wtf-is-jsx
     * Benchmarks: https://esbench.com/bench/57ee8f8e330ab09900a1a1a0
     *
     * Note: this is exported as both `h()` and `createElement()` for compatibility reasons.
     *
     * Creates a VNode (virtual DOM element). A tree of VNodes can be used as a lightweight representation
     * of the structure of a DOM tree. This structure can be realized by recursively comparing it against
     * the current _actual_ DOM structure, and applying only the differences.
     *
     * `h()`/`createElement()` accepts an element name, a list of attributes/props,
     * and optionally children to append to the element.
     *
     * @example The following DOM tree
     *
     * `<div id="foo" name="bar">Hello!</div>`
     *
     * can be constructed using this function as:
     *
     * `h('div', { id: 'foo', name : 'bar' }, 'Hello!');`
     *
     * @param {string} nodeName	An element name. Ex: `div`, `a`, `span`, etc.
     * @param {Object} attributes	Any attributes/props to set on the created element.
     * @param rest			Additional arguments are taken to be children to append. Can be infinitely nested Arrays.
     *
     * @public
     */
    function h(nodeName, attributes) {
    	var children = EMPTY_CHILDREN,
    	    lastSimple,
    	    child,
    	    simple,
    	    i;
    	for (i = arguments.length; i-- > 2;) {
    		stack.push(arguments[i]);
    	}
    	if (attributes && attributes.children != null) {
    		if (!stack.length) stack.push(attributes.children);
    		delete attributes.children;
    	}
    	while (stack.length) {
    		if ((child = stack.pop()) && child.pop !== undefined) {
    			for (i = child.length; i--;) {
    				stack.push(child[i]);
    			}
    		} else {
    			if (typeof child === 'boolean') child = null;

    			if (simple = typeof nodeName !== 'function') {
    				if (child == null) child = '';else if (typeof child === 'number') child = String(child);else if (typeof child !== 'string') simple = false;
    			}

    			if (simple && lastSimple) {
    				children[children.length - 1] += child;
    			} else if (children === EMPTY_CHILDREN) {
    				children = [child];
    			} else {
    				children.push(child);
    			}

    			lastSimple = simple;
    		}
    	}

    	var p = new VNode();
    	p.nodeName = nodeName;
    	p.children = children;
    	p.attributes = attributes == null ? undefined : attributes;
    	p.key = attributes == null ? undefined : attributes.key;

    	// if a "vnode hook" is defined, pass every created VNode to it
    	if (options.vnode !== undefined) options.vnode(p);

    	return p;
    }

    /**
     *  Copy all properties from `props` onto `obj`.
     *  @param {Object} obj		Object onto which properties should be copied.
     *  @param {Object} props	Object from which to copy properties.
     *  @returns obj
     *  @private
     */
    function extend(obj, props) {
      for (var i in props) {
        obj[i] = props[i];
      }return obj;
    }

    /**
     * Call a function asynchronously, as soon as possible. Makes
     * use of HTML Promise to schedule the callback if available,
     * otherwise falling back to `setTimeout` (mainly for IE<11).
     *
     * @param {Function} callback
     */
    var defer = typeof Promise == 'function' ? Promise.resolve().then.bind(Promise.resolve()) : setTimeout;

    /**
     * Clones the given VNode, optionally adding attributes/props and replacing its children.
     * @param {VNode} vnode		The virtual DOM element to clone
     * @param {Object} props	Attributes/props to add when cloning
     * @param {VNode} rest		Any additional arguments will be used as replacement children.
     */
    function cloneElement(vnode, props) {
      return h(vnode.nodeName, extend(extend({}, vnode.attributes), props), arguments.length > 2 ? [].slice.call(arguments, 2) : vnode.children);
    }

    // DOM properties that should NOT have "px" added when numeric
    var IS_NON_DIMENSIONAL = /acit|ex(?:s|g|n|p|$)|rph|ows|mnc|ntw|ine[ch]|zoo|^ord/i;

    /** Managed queue of dirty components to be re-rendered */

    var items = [];

    function enqueueRender(component) {
    	if (!component._dirty && (component._dirty = true) && items.push(component) == 1) {
    		(options.debounceRendering || defer)(rerender);
    	}
    }

    function rerender() {
    	var p,
    	    list = items;
    	items = [];
    	while (p = list.pop()) {
    		if (p._dirty) renderComponent(p);
    	}
    }

    /**
     * Check if two nodes are equivalent.
     *
     * @param {Node} node			DOM Node to compare
     * @param {VNode} vnode			Virtual DOM node to compare
     * @param {boolean} [hydrating=false]	If true, ignores component constructors when comparing.
     * @private
     */
    function isSameNodeType(node, vnode, hydrating) {
      if (typeof vnode === 'string' || typeof vnode === 'number') {
        return node.splitText !== undefined;
      }
      if (typeof vnode.nodeName === 'string') {
        return !node._componentConstructor && isNamedNode(node, vnode.nodeName);
      }
      return hydrating || node._componentConstructor === vnode.nodeName;
    }

    /**
     * Check if an Element has a given nodeName, case-insensitively.
     *
     * @param {Element} node	A DOM Element to inspect the name of.
     * @param {String} nodeName	Unnormalized name to compare against.
     */
    function isNamedNode(node, nodeName) {
      return node.normalizedNodeName === nodeName || node.nodeName.toLowerCase() === nodeName.toLowerCase();
    }

    /**
     * Reconstruct Component-style `props` from a VNode.
     * Ensures default/fallback values from `defaultProps`:
     * Own-properties of `defaultProps` not present in `vnode.attributes` are added.
     *
     * @param {VNode} vnode
     * @returns {Object} props
     */
    function getNodeProps(vnode) {
      var props = extend({}, vnode.attributes);
      props.children = vnode.children;

      var defaultProps = vnode.nodeName.defaultProps;
      if (defaultProps !== undefined) {
        for (var i in defaultProps) {
          if (props[i] === undefined) {
            props[i] = defaultProps[i];
          }
        }
      }

      return props;
    }

    /** Create an element with the given nodeName.
     *	@param {String} nodeName
     *	@param {Boolean} [isSvg=false]	If `true`, creates an element within the SVG namespace.
     *	@returns {Element} node
     */
    function createNode(nodeName, isSvg) {
    	var node = isSvg ? document.createElementNS('http://www.w3.org/2000/svg', nodeName) : document.createElement(nodeName);
    	node.normalizedNodeName = nodeName;
    	return node;
    }

    /** Remove a child node from its parent if attached.
     *	@param {Element} node		The node to remove
     */
    function removeNode(node) {
    	var parentNode = node.parentNode;
    	if (parentNode) parentNode.removeChild(node);
    }

    /** Set a named attribute on the given Node, with special behavior for some names and event handlers.
     *	If `value` is `null`, the attribute/handler will be removed.
     *	@param {Element} node	An element to mutate
     *	@param {string} name	The name/key to set, such as an event or attribute name
     *	@param {any} old	The last value that was set for this name/node pair
     *	@param {any} value	An attribute value, such as a function to be used as an event handler
     *	@param {Boolean} isSvg	Are we currently diffing inside an svg?
     *	@private
     */
    function setAccessor(node, name, old, value, isSvg) {
    	if (name === 'className') name = 'class';

    	if (name === 'key') ; else if (name === 'ref') {
    		if (old) old(null);
    		if (value) value(node);
    	} else if (name === 'class' && !isSvg) {
    		node.className = value || '';
    	} else if (name === 'style') {
    		if (!value || typeof value === 'string' || typeof old === 'string') {
    			node.style.cssText = value || '';
    		}
    		if (value && typeof value === 'object') {
    			if (typeof old !== 'string') {
    				for (var i in old) {
    					if (!(i in value)) node.style[i] = '';
    				}
    			}
    			for (var i in value) {
    				node.style[i] = typeof value[i] === 'number' && IS_NON_DIMENSIONAL.test(i) === false ? value[i] + 'px' : value[i];
    			}
    		}
    	} else if (name === 'dangerouslySetInnerHTML') {
    		if (value) node.innerHTML = value.__html || '';
    	} else if (name[0] == 'o' && name[1] == 'n') {
    		var useCapture = name !== (name = name.replace(/Capture$/, ''));
    		name = name.toLowerCase().substring(2);
    		if (value) {
    			if (!old) node.addEventListener(name, eventProxy, useCapture);
    		} else {
    			node.removeEventListener(name, eventProxy, useCapture);
    		}
    		(node._listeners || (node._listeners = {}))[name] = value;
    	} else if (name !== 'list' && name !== 'type' && !isSvg && name in node) {
    		setProperty(node, name, value == null ? '' : value);
    		if (value == null || value === false) node.removeAttribute(name);
    	} else {
    		var ns = isSvg && name !== (name = name.replace(/^xlink:?/, ''));
    		if (value == null || value === false) {
    			if (ns) node.removeAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase());else node.removeAttribute(name);
    		} else if (typeof value !== 'function') {
    			if (ns) node.setAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase(), value);else node.setAttribute(name, value);
    		}
    	}
    }

    /** Attempt to set a DOM property to the given value.
     *	IE & FF throw for certain property-value combinations.
     */
    function setProperty(node, name, value) {
    	try {
    		node[name] = value;
    	} catch (e) {}
    }

    /** Proxy an event to hooked event handlers
     *	@private
     */
    function eventProxy(e) {
    	return this._listeners[e.type](options.event && options.event(e) || e);
    }

    /** Queue of components that have been mounted and are awaiting componentDidMount */
    var mounts = [];

    /** Diff recursion count, used to track the end of the diff cycle. */
    var diffLevel = 0;

    /** Global flag indicating if the diff is currently within an SVG */
    var isSvgMode = false;

    /** Global flag indicating if the diff is performing hydration */
    var hydrating = false;

    /** Invoke queued componentDidMount lifecycle methods */
    function flushMounts() {
    	var c;
    	while (c = mounts.pop()) {
    		if (options.afterMount) options.afterMount(c);
    		if (c.componentDidMount) c.componentDidMount();
    	}
    }

    /** Apply differences in a given vnode (and it's deep children) to a real DOM Node.
     *	@param {Element} [dom=null]		A DOM node to mutate into the shape of the `vnode`
     *	@param {VNode} vnode			A VNode (with descendants forming a tree) representing the desired DOM structure
     *	@returns {Element} dom			The created/mutated element
     *	@private
     */
    function diff(dom, vnode, context, mountAll, parent, componentRoot) {
    	// diffLevel having been 0 here indicates initial entry into the diff (not a subdiff)
    	if (!diffLevel++) {
    		// when first starting the diff, check if we're diffing an SVG or within an SVG
    		isSvgMode = parent != null && parent.ownerSVGElement !== undefined;

    		// hydration is indicated by the existing element to be diffed not having a prop cache
    		hydrating = dom != null && !('__preactattr_' in dom);
    	}

    	var ret = idiff(dom, vnode, context, mountAll, componentRoot);

    	// append the element if its a new parent
    	if (parent && ret.parentNode !== parent) parent.appendChild(ret);

    	// diffLevel being reduced to 0 means we're exiting the diff
    	if (! --diffLevel) {
    		hydrating = false;
    		// invoke queued componentDidMount lifecycle methods
    		if (!componentRoot) flushMounts();
    	}

    	return ret;
    }

    /** Internals of `diff()`, separated to allow bypassing diffLevel / mount flushing. */
    function idiff(dom, vnode, context, mountAll, componentRoot) {
    	var out = dom,
    	    prevSvgMode = isSvgMode;

    	// empty values (null, undefined, booleans) render as empty Text nodes
    	if (vnode == null || typeof vnode === 'boolean') vnode = '';

    	// Fast case: Strings & Numbers create/update Text nodes.
    	if (typeof vnode === 'string' || typeof vnode === 'number') {

    		// update if it's already a Text node:
    		if (dom && dom.splitText !== undefined && dom.parentNode && (!dom._component || componentRoot)) {
    			/* istanbul ignore if */ /* Browser quirk that can't be covered: https://github.com/developit/preact/commit/fd4f21f5c45dfd75151bd27b4c217d8003aa5eb9 */
    			if (dom.nodeValue != vnode) {
    				dom.nodeValue = vnode;
    			}
    		} else {
    			// it wasn't a Text node: replace it with one and recycle the old Element
    			out = document.createTextNode(vnode);
    			if (dom) {
    				if (dom.parentNode) dom.parentNode.replaceChild(out, dom);
    				recollectNodeTree(dom, true);
    			}
    		}

    		out['__preactattr_'] = true;

    		return out;
    	}

    	// If the VNode represents a Component, perform a component diff:
    	var vnodeName = vnode.nodeName;
    	if (typeof vnodeName === 'function') {
    		return buildComponentFromVNode(dom, vnode, context, mountAll);
    	}

    	// Tracks entering and exiting SVG namespace when descending through the tree.
    	isSvgMode = vnodeName === 'svg' ? true : vnodeName === 'foreignObject' ? false : isSvgMode;

    	// If there's no existing element or it's the wrong type, create a new one:
    	vnodeName = String(vnodeName);
    	if (!dom || !isNamedNode(dom, vnodeName)) {
    		out = createNode(vnodeName, isSvgMode);

    		if (dom) {
    			// move children into the replacement node
    			while (dom.firstChild) {
    				out.appendChild(dom.firstChild);
    			} // if the previous Element was mounted into the DOM, replace it inline
    			if (dom.parentNode) dom.parentNode.replaceChild(out, dom);

    			// recycle the old element (skips non-Element node types)
    			recollectNodeTree(dom, true);
    		}
    	}

    	var fc = out.firstChild,
    	    props = out['__preactattr_'],
    	    vchildren = vnode.children;

    	if (props == null) {
    		props = out['__preactattr_'] = {};
    		for (var a = out.attributes, i = a.length; i--;) {
    			props[a[i].name] = a[i].value;
    		}
    	}

    	// Optimization: fast-path for elements containing a single TextNode:
    	if (!hydrating && vchildren && vchildren.length === 1 && typeof vchildren[0] === 'string' && fc != null && fc.splitText !== undefined && fc.nextSibling == null) {
    		if (fc.nodeValue != vchildren[0]) {
    			fc.nodeValue = vchildren[0];
    		}
    	}
    	// otherwise, if there are existing or new children, diff them:
    	else if (vchildren && vchildren.length || fc != null) {
    			innerDiffNode(out, vchildren, context, mountAll, hydrating || props.dangerouslySetInnerHTML != null);
    		}

    	// Apply attributes/props from VNode to the DOM Element:
    	diffAttributes(out, vnode.attributes, props);

    	// restore previous SVG mode: (in case we're exiting an SVG namespace)
    	isSvgMode = prevSvgMode;

    	return out;
    }

    /** Apply child and attribute changes between a VNode and a DOM Node to the DOM.
     *	@param {Element} dom			Element whose children should be compared & mutated
     *	@param {Array} vchildren		Array of VNodes to compare to `dom.childNodes`
     *	@param {Object} context			Implicitly descendant context object (from most recent `getChildContext()`)
     *	@param {Boolean} mountAll
     *	@param {Boolean} isHydrating	If `true`, consumes externally created elements similar to hydration
     */
    function innerDiffNode(dom, vchildren, context, mountAll, isHydrating) {
    	var originalChildren = dom.childNodes,
    	    children = [],
    	    keyed = {},
    	    keyedLen = 0,
    	    min = 0,
    	    len = originalChildren.length,
    	    childrenLen = 0,
    	    vlen = vchildren ? vchildren.length : 0,
    	    j,
    	    c,
    	    f,
    	    vchild,
    	    child;

    	// Build up a map of keyed children and an Array of unkeyed children:
    	if (len !== 0) {
    		for (var i = 0; i < len; i++) {
    			var _child = originalChildren[i],
    			    props = _child['__preactattr_'],
    			    key = vlen && props ? _child._component ? _child._component.__key : props.key : null;
    			if (key != null) {
    				keyedLen++;
    				keyed[key] = _child;
    			} else if (props || (_child.splitText !== undefined ? isHydrating ? _child.nodeValue.trim() : true : isHydrating)) {
    				children[childrenLen++] = _child;
    			}
    		}
    	}

    	if (vlen !== 0) {
    		for (var i = 0; i < vlen; i++) {
    			vchild = vchildren[i];
    			child = null;

    			// attempt to find a node based on key matching
    			var key = vchild.key;
    			if (key != null) {
    				if (keyedLen && keyed[key] !== undefined) {
    					child = keyed[key];
    					keyed[key] = undefined;
    					keyedLen--;
    				}
    			}
    			// attempt to pluck a node of the same type from the existing children
    			else if (!child && min < childrenLen) {
    					for (j = min; j < childrenLen; j++) {
    						if (children[j] !== undefined && isSameNodeType(c = children[j], vchild, isHydrating)) {
    							child = c;
    							children[j] = undefined;
    							if (j === childrenLen - 1) childrenLen--;
    							if (j === min) min++;
    							break;
    						}
    					}
    				}

    			// morph the matched/found/created DOM child to match vchild (deep)
    			child = idiff(child, vchild, context, mountAll);

    			f = originalChildren[i];
    			if (child && child !== dom && child !== f) {
    				if (f == null) {
    					dom.appendChild(child);
    				} else if (child === f.nextSibling) {
    					removeNode(f);
    				} else {
    					dom.insertBefore(child, f);
    				}
    			}
    		}
    	}

    	// remove unused keyed children:
    	if (keyedLen) {
    		for (var i in keyed) {
    			if (keyed[i] !== undefined) recollectNodeTree(keyed[i], false);
    		}
    	}

    	// remove orphaned unkeyed children:
    	while (min <= childrenLen) {
    		if ((child = children[childrenLen--]) !== undefined) recollectNodeTree(child, false);
    	}
    }

    /** Recursively recycle (or just unmount) a node and its descendants.
     *	@param {Node} node						DOM node to start unmount/removal from
     *	@param {Boolean} [unmountOnly=false]	If `true`, only triggers unmount lifecycle, skips removal
     */
    function recollectNodeTree(node, unmountOnly) {
    	var component = node._component;
    	if (component) {
    		// if node is owned by a Component, unmount that component (ends up recursing back here)
    		unmountComponent(component);
    	} else {
    		// If the node's VNode had a ref function, invoke it with null here.
    		// (this is part of the React spec, and smart for unsetting references)
    		if (node['__preactattr_'] != null && node['__preactattr_'].ref) node['__preactattr_'].ref(null);

    		if (unmountOnly === false || node['__preactattr_'] == null) {
    			removeNode(node);
    		}

    		removeChildren(node);
    	}
    }

    /** Recollect/unmount all children.
     *	- we use .lastChild here because it causes less reflow than .firstChild
     *	- it's also cheaper than accessing the .childNodes Live NodeList
     */
    function removeChildren(node) {
    	node = node.lastChild;
    	while (node) {
    		var next = node.previousSibling;
    		recollectNodeTree(node, true);
    		node = next;
    	}
    }

    /** Apply differences in attributes from a VNode to the given DOM Element.
     *	@param {Element} dom		Element with attributes to diff `attrs` against
     *	@param {Object} attrs		The desired end-state key-value attribute pairs
     *	@param {Object} old			Current/previous attributes (from previous VNode or element's prop cache)
     */
    function diffAttributes(dom, attrs, old) {
    	var name;

    	// remove attributes no longer present on the vnode by setting them to undefined
    	for (name in old) {
    		if (!(attrs && attrs[name] != null) && old[name] != null) {
    			setAccessor(dom, name, old[name], old[name] = undefined, isSvgMode);
    		}
    	}

    	// add new & update changed attributes
    	for (name in attrs) {
    		if (name !== 'children' && name !== 'innerHTML' && (!(name in old) || attrs[name] !== (name === 'value' || name === 'checked' ? dom[name] : old[name]))) {
    			setAccessor(dom, name, old[name], old[name] = attrs[name], isSvgMode);
    		}
    	}
    }

    /** Retains a pool of Components for re-use, keyed on component name.
     *	Note: since component names are not unique or even necessarily available, these are primarily a form of sharding.
     *	@private
     */
    var components = {};

    /** Reclaim a component for later re-use by the recycler. */
    function collectComponent(component) {
    	var name = component.constructor.name;
    	(components[name] || (components[name] = [])).push(component);
    }

    /** Create a component. Normalizes differences between PFC's and classful Components. */
    function createComponent(Ctor, props, context) {
    	var list = components[Ctor.name],
    	    inst;

    	if (Ctor.prototype && Ctor.prototype.render) {
    		inst = new Ctor(props, context);
    		Component.call(inst, props, context);
    	} else {
    		inst = new Component(props, context);
    		inst.constructor = Ctor;
    		inst.render = doRender;
    	}

    	if (list) {
    		for (var i = list.length; i--;) {
    			if (list[i].constructor === Ctor) {
    				inst.nextBase = list[i].nextBase;
    				list.splice(i, 1);
    				break;
    			}
    		}
    	}
    	return inst;
    }

    /** The `.render()` method for a PFC backing instance. */
    function doRender(props, state, context) {
    	return this.constructor(props, context);
    }

    /** Set a component's `props` (generally derived from JSX attributes).
     *	@param {Object} props
     *	@param {Object} [opts]
     *	@param {boolean} [opts.renderSync=false]	If `true` and {@link options.syncComponentUpdates} is `true`, triggers synchronous rendering.
     *	@param {boolean} [opts.render=true]			If `false`, no render will be triggered.
     */
    function setComponentProps(component, props, opts, context, mountAll) {
    	if (component._disable) return;
    	component._disable = true;

    	if (component.__ref = props.ref) delete props.ref;
    	if (component.__key = props.key) delete props.key;

    	if (!component.base || mountAll) {
    		if (component.componentWillMount) component.componentWillMount();
    	} else if (component.componentWillReceiveProps) {
    		component.componentWillReceiveProps(props, context);
    	}

    	if (context && context !== component.context) {
    		if (!component.prevContext) component.prevContext = component.context;
    		component.context = context;
    	}

    	if (!component.prevProps) component.prevProps = component.props;
    	component.props = props;

    	component._disable = false;

    	if (opts !== 0) {
    		if (opts === 1 || options.syncComponentUpdates !== false || !component.base) {
    			renderComponent(component, 1, mountAll);
    		} else {
    			enqueueRender(component);
    		}
    	}

    	if (component.__ref) component.__ref(component);
    }

    /** Render a Component, triggering necessary lifecycle events and taking High-Order Components into account.
     *	@param {Component} component
     *	@param {Object} [opts]
     *	@param {boolean} [opts.build=false]		If `true`, component will build and store a DOM node if not already associated with one.
     *	@private
     */
    function renderComponent(component, opts, mountAll, isChild) {
    	if (component._disable) return;

    	var props = component.props,
    	    state = component.state,
    	    context = component.context,
    	    previousProps = component.prevProps || props,
    	    previousState = component.prevState || state,
    	    previousContext = component.prevContext || context,
    	    isUpdate = component.base,
    	    nextBase = component.nextBase,
    	    initialBase = isUpdate || nextBase,
    	    initialChildComponent = component._component,
    	    skip = false,
    	    rendered,
    	    inst,
    	    cbase;

    	// if updating
    	if (isUpdate) {
    		component.props = previousProps;
    		component.state = previousState;
    		component.context = previousContext;
    		if (opts !== 2 && component.shouldComponentUpdate && component.shouldComponentUpdate(props, state, context) === false) {
    			skip = true;
    		} else if (component.componentWillUpdate) {
    			component.componentWillUpdate(props, state, context);
    		}
    		component.props = props;
    		component.state = state;
    		component.context = context;
    	}

    	component.prevProps = component.prevState = component.prevContext = component.nextBase = null;
    	component._dirty = false;

    	if (!skip) {
    		rendered = component.render(props, state, context);

    		// context to pass to the child, can be updated via (grand-)parent component
    		if (component.getChildContext) {
    			context = extend(extend({}, context), component.getChildContext());
    		}

    		var childComponent = rendered && rendered.nodeName,
    		    toUnmount,
    		    base;

    		if (typeof childComponent === 'function') {
    			// set up high order component link

    			var childProps = getNodeProps(rendered);
    			inst = initialChildComponent;

    			if (inst && inst.constructor === childComponent && childProps.key == inst.__key) {
    				setComponentProps(inst, childProps, 1, context, false);
    			} else {
    				toUnmount = inst;

    				component._component = inst = createComponent(childComponent, childProps, context);
    				inst.nextBase = inst.nextBase || nextBase;
    				inst._parentComponent = component;
    				setComponentProps(inst, childProps, 0, context, false);
    				renderComponent(inst, 1, mountAll, true);
    			}

    			base = inst.base;
    		} else {
    			cbase = initialBase;

    			// destroy high order component link
    			toUnmount = initialChildComponent;
    			if (toUnmount) {
    				cbase = component._component = null;
    			}

    			if (initialBase || opts === 1) {
    				if (cbase) cbase._component = null;
    				base = diff(cbase, rendered, context, mountAll || !isUpdate, initialBase && initialBase.parentNode, true);
    			}
    		}

    		if (initialBase && base !== initialBase && inst !== initialChildComponent) {
    			var baseParent = initialBase.parentNode;
    			if (baseParent && base !== baseParent) {
    				baseParent.replaceChild(base, initialBase);

    				if (!toUnmount) {
    					initialBase._component = null;
    					recollectNodeTree(initialBase, false);
    				}
    			}
    		}

    		if (toUnmount) {
    			unmountComponent(toUnmount);
    		}

    		component.base = base;
    		if (base && !isChild) {
    			var componentRef = component,
    			    t = component;
    			while (t = t._parentComponent) {
    				(componentRef = t).base = base;
    			}
    			base._component = componentRef;
    			base._componentConstructor = componentRef.constructor;
    		}
    	}

    	if (!isUpdate || mountAll) {
    		mounts.unshift(component);
    	} else if (!skip) {
    		// Ensure that pending componentDidMount() hooks of child components
    		// are called before the componentDidUpdate() hook in the parent.
    		// Note: disabled as it causes duplicate hooks, see https://github.com/developit/preact/issues/750
    		// flushMounts();

    		if (component.componentDidUpdate) {
    			component.componentDidUpdate(previousProps, previousState, previousContext);
    		}
    		if (options.afterUpdate) options.afterUpdate(component);
    	}

    	if (component._renderCallbacks != null) {
    		while (component._renderCallbacks.length) {
    			component._renderCallbacks.pop().call(component);
    		}
    	}

    	if (!diffLevel && !isChild) flushMounts();
    }

    /** Apply the Component referenced by a VNode to the DOM.
     *	@param {Element} dom	The DOM node to mutate
     *	@param {VNode} vnode	A Component-referencing VNode
     *	@returns {Element} dom	The created/mutated element
     *	@private
     */
    function buildComponentFromVNode(dom, vnode, context, mountAll) {
    	var c = dom && dom._component,
    	    originalComponent = c,
    	    oldDom = dom,
    	    isDirectOwner = c && dom._componentConstructor === vnode.nodeName,
    	    isOwner = isDirectOwner,
    	    props = getNodeProps(vnode);
    	while (c && !isOwner && (c = c._parentComponent)) {
    		isOwner = c.constructor === vnode.nodeName;
    	}

    	if (c && isOwner && (!mountAll || c._component)) {
    		setComponentProps(c, props, 3, context, mountAll);
    		dom = c.base;
    	} else {
    		if (originalComponent && !isDirectOwner) {
    			unmountComponent(originalComponent);
    			dom = oldDom = null;
    		}

    		c = createComponent(vnode.nodeName, props, context);
    		if (dom && !c.nextBase) {
    			c.nextBase = dom;
    			// passing dom/oldDom as nextBase will recycle it if unused, so bypass recycling on L229:
    			oldDom = null;
    		}
    		setComponentProps(c, props, 1, context, mountAll);
    		dom = c.base;

    		if (oldDom && dom !== oldDom) {
    			oldDom._component = null;
    			recollectNodeTree(oldDom, false);
    		}
    	}

    	return dom;
    }

    /** Remove a component from the DOM and recycle it.
     *	@param {Component} component	The Component instance to unmount
     *	@private
     */
    function unmountComponent(component) {
    	if (options.beforeUnmount) options.beforeUnmount(component);

    	var base = component.base;

    	component._disable = true;

    	if (component.componentWillUnmount) component.componentWillUnmount();

    	component.base = null;

    	// recursively tear down & recollect high-order component children:
    	var inner = component._component;
    	if (inner) {
    		unmountComponent(inner);
    	} else if (base) {
    		if (base['__preactattr_'] && base['__preactattr_'].ref) base['__preactattr_'].ref(null);

    		component.nextBase = base;

    		removeNode(base);
    		collectComponent(component);

    		removeChildren(base);
    	}

    	if (component.__ref) component.__ref(null);
    }

    /** Base Component class.
     *	Provides `setState()` and `forceUpdate()`, which trigger rendering.
     *	@public
     *
     *	@example
     *	class MyFoo extends Component {
     *		render(props, state) {
     *			return <div />;
     *		}
     *	}
     */
    function Component(props, context) {
    	this._dirty = true;

    	/** @public
      *	@type {object}
      */
    	this.context = context;

    	/** @public
      *	@type {object}
      */
    	this.props = props;

    	/** @public
      *	@type {object}
      */
    	this.state = this.state || {};
    }

    extend(Component.prototype, {

    	/** Returns a `boolean` indicating if the component should re-render when receiving the given `props` and `state`.
      *	@param {object} nextProps
      *	@param {object} nextState
      *	@param {object} nextContext
      *	@returns {Boolean} should the component re-render
      *	@name shouldComponentUpdate
      *	@function
      */

    	/** Update component state by copying properties from `state` to `this.state`.
      *	@param {object} state		A hash of state properties to update with new values
      *	@param {function} callback	A function to be called once component state is updated
      */
    	setState: function setState(state, callback) {
    		var s = this.state;
    		if (!this.prevState) this.prevState = extend({}, s);
    		extend(s, typeof state === 'function' ? state(s, this.props) : state);
    		if (callback) (this._renderCallbacks = this._renderCallbacks || []).push(callback);
    		enqueueRender(this);
    	},


    	/** Immediately perform a synchronous re-render of the component.
      *	@param {function} callback		A function to be called after component is re-rendered.
      *	@private
      */
    	forceUpdate: function forceUpdate(callback) {
    		if (callback) (this._renderCallbacks = this._renderCallbacks || []).push(callback);
    		renderComponent(this, 2);
    	},


    	/** Accepts `props` and `state`, and returns a new Virtual DOM tree to build.
      *	Virtual DOM is generally constructed via [JSX](http://jasonformat.com/wtf-is-jsx).
      *	@param {object} props		Props (eg: JSX attributes) received from parent element/component
      *	@param {object} state		The component's current state
      *	@param {object} context		Context object (if a parent component has provided context)
      *	@returns VNode
      */
    	render: function render() {}
    });

    /** Render JSX into a `parent` Element.
     *	@param {VNode} vnode		A (JSX) VNode to render
     *	@param {Element} parent		DOM element to render into
     *	@param {Element} [merge]	Attempt to re-use an existing DOM tree rooted at `merge`
     *	@public
     *
     *	@example
     *	// render a div into <body>:
     *	render(<div id="hello">hello!</div>, document.body);
     *
     *	@example
     *	// render a "Thing" component into #foo:
     *	const Thing = ({ name }) => <span>{ name }</span>;
     *	render(<Thing name="one" />, document.querySelector('#foo'));
     */
    function render(vnode, parent, merge) {
      return diff(merge, vnode, {}, false, parent, false);
    }

    var preact = {
    	h: h,
    	createElement: h,
    	cloneElement: cloneElement,
    	Component: Component,
    	render: render,
    	rerender: rerender,
    	options: options
    };

    var preact_esm = /*#__PURE__*/Object.freeze({
        __proto__: null,
        'default': preact,
        h: h,
        createElement: h,
        cloneElement: cloneElement,
        Component: Component,
        render: render,
        rerender: rerender,
        options: options
    });

    var hasProperty = function has(object, key) {
      return Object.prototype.hasOwnProperty.call(object, key);
    };

    function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }


    /**
     * Translates strings with interpolation & pluralization support.
     * Extensible with custom dictionaries and pluralization functions.
     *
     * Borrows heavily from and inspired by Polyglot https://github.com/airbnb/polyglot.js,
     * basically a stripped-down version of it. Differences: pluralization functions are not hardcoded
     * and can be easily added among with dictionaries, nested objects are used for pluralization
     * as opposed to `||||` delimeter
     *
     * Usage example: `translator.translate('files_chosen', {smart_count: 3})`
     */


    var Translator = /*#__PURE__*/function () {
      /**
       * @param {object|Array<object>} locales - locale or list of locales.
       */
      function Translator(locales) {
        var _this = this;

        this.locale = {
          strings: {},
          pluralize: function pluralize(n) {
            if (n === 1) {
              return 0;
            }

            return 1;
          }
        };

        if (Array.isArray(locales)) {
          locales.forEach(function (locale) {
            return _this._apply(locale);
          });
        } else {
          this._apply(locales);
        }
      }

      var _proto = Translator.prototype;

      _proto._apply = function _apply(locale) {
        if (!locale || !locale.strings) {
          return;
        }

        var prevLocale = this.locale;
        this.locale = _extends({}, prevLocale, {
          strings: _extends({}, prevLocale.strings, locale.strings)
        });
        this.locale.pluralize = locale.pluralize || prevLocale.pluralize;
      }
      /**
       * Takes a string with placeholder variables like `%{smart_count} file selected`
       * and replaces it with values from options `{smart_count: 5}`
       *
       * @license https://github.com/airbnb/polyglot.js/blob/master/LICENSE
       * taken from https://github.com/airbnb/polyglot.js/blob/master/lib/polyglot.js#L299
       *
       * @param {string} phrase that needs interpolation, with placeholders
       * @param {object} options with values that will be used to replace placeholders
       * @returns {string} interpolated
       */
      ;

      _proto.interpolate = function interpolate(phrase, options) {
        var _String$prototype = String.prototype,
            split = _String$prototype.split,
            replace = _String$prototype.replace;
        var dollarRegex = /\$/g;
        var dollarBillsYall = '$$$$';
        var interpolated = [phrase];

        for (var arg in options) {
          if (arg !== '_' && hasProperty(options, arg)) {
            // Ensure replacement value is escaped to prevent special $-prefixed
            // regex replace tokens. the "$$$$" is needed because each "$" needs to
            // be escaped with "$" itself, and we need two in the resulting output.
            var replacement = options[arg];

            if (typeof replacement === 'string') {
              replacement = replace.call(options[arg], dollarRegex, dollarBillsYall);
            } // We create a new `RegExp` each time instead of using a more-efficient
            // string replace so that the same argument can be replaced multiple times
            // in the same phrase.


            interpolated = insertReplacement(interpolated, new RegExp("%\\{" + arg + "\\}", 'g'), replacement);
          }
        }

        return interpolated;

        function insertReplacement(source, rx, replacement) {
          var newParts = [];
          source.forEach(function (chunk) {
            // When the source contains multiple placeholders for interpolation,
            // we should ignore chunks that are not strings, because those
            // can be JSX objects and will be otherwise incorrectly turned into strings.
            // Without this condition we’d get this: [object Object] hello [object Object] my <button>
            if (typeof chunk !== 'string') {
              return newParts.push(chunk);
            }

            split.call(chunk, rx).forEach(function (raw, i, list) {
              if (raw !== '') {
                newParts.push(raw);
              } // Interlace with the `replacement` value


              if (i < list.length - 1) {
                newParts.push(replacement);
              }
            });
          });
          return newParts;
        }
      }
      /**
       * Public translate method
       *
       * @param {string} key
       * @param {object} options with values that will be used later to replace placeholders in string
       * @returns {string} translated (and interpolated)
       */
      ;

      _proto.translate = function translate(key, options) {
        return this.translateArray(key, options).join('');
      }
      /**
       * Get a translation and return the translated and interpolated parts as an array.
       *
       * @param {string} key
       * @param {object} options with values that will be used to replace placeholders
       * @returns {Array} The translated and interpolated parts, in order.
       */
      ;

      _proto.translateArray = function translateArray(key, options) {
        if (!hasProperty(this.locale.strings, key)) {
          throw new Error("missing string: " + key);
        }

        var string = this.locale.strings[key];
        var hasPluralForms = typeof string === 'object';

        if (hasPluralForms) {
          if (options && typeof options.smart_count !== 'undefined') {
            var plural = this.locale.pluralize(options.smart_count);
            return this.interpolate(string[plural], options);
          }

          throw new Error('Attempted to use a string with plural forms, but no value was given for %{smart_count}');
        }

        return this.interpolate(string, options);
      };

      return Translator;
    }();

    /**
    * Create an event emitter with namespaces
    * @name createNamespaceEmitter
    * @example
    * var emitter = require('./index')()
    *
    * emitter.on('*', function () {
    *   console.log('all events emitted', this.event)
    * })
    *
    * emitter.on('example', function () {
    *   console.log('example event emitted')
    * })
    */
    var namespaceEmitter = function createNamespaceEmitter () {
      var emitter = {};
      var _fns = emitter._fns = {};

      /**
      * Emit an event. Optionally namespace the event. Handlers are fired in the order in which they were added with exact matches taking precedence. Separate the namespace and event with a `:`
      * @name emit
      * @param {String} event – the name of the event, with optional namespace
      * @param {...*} data – up to 6 arguments that are passed to the event listener
      * @example
      * emitter.emit('example')
      * emitter.emit('demo:test')
      * emitter.emit('data', { example: true}, 'a string', 1)
      */
      emitter.emit = function emit (event, arg1, arg2, arg3, arg4, arg5, arg6) {
        var toEmit = getListeners(event);

        if (toEmit.length) {
          emitAll(event, toEmit, [arg1, arg2, arg3, arg4, arg5, arg6]);
        }
      };

      /**
      * Create en event listener.
      * @name on
      * @param {String} event
      * @param {Function} fn
      * @example
      * emitter.on('example', function () {})
      * emitter.on('demo', function () {})
      */
      emitter.on = function on (event, fn) {
        if (!_fns[event]) {
          _fns[event] = [];
        }

        _fns[event].push(fn);
      };

      /**
      * Create en event listener that fires once.
      * @name once
      * @param {String} event
      * @param {Function} fn
      * @example
      * emitter.once('example', function () {})
      * emitter.once('demo', function () {})
      */
      emitter.once = function once (event, fn) {
        function one () {
          fn.apply(this, arguments);
          emitter.off(event, one);
        }
        this.on(event, one);
      };

      /**
      * Stop listening to an event. Stop all listeners on an event by only passing the event name. Stop a single listener by passing that event handler as a callback.
      * You must be explicit about what will be unsubscribed: `emitter.off('demo')` will unsubscribe an `emitter.on('demo')` listener,
      * `emitter.off('demo:example')` will unsubscribe an `emitter.on('demo:example')` listener
      * @name off
      * @param {String} event
      * @param {Function} [fn] – the specific handler
      * @example
      * emitter.off('example')
      * emitter.off('demo', function () {})
      */
      emitter.off = function off (event, fn) {
        var keep = [];

        if (event && fn) {
          var fns = this._fns[event];
          var i = 0;
          var l = fns ? fns.length : 0;

          for (i; i < l; i++) {
            if (fns[i] !== fn) {
              keep.push(fns[i]);
            }
          }
        }

        keep.length ? this._fns[event] = keep : delete this._fns[event];
      };

      function getListeners (e) {
        var out = _fns[e] ? _fns[e] : [];
        var idx = e.indexOf(':');
        var args = (idx === -1) ? [e] : [e.substring(0, idx), e.substring(idx + 1)];

        var keys = Object.keys(_fns);
        var i = 0;
        var l = keys.length;

        for (i; i < l; i++) {
          var key = keys[i];
          if (key === '*') {
            out = out.concat(_fns[key]);
          }

          if (args.length === 2 && args[0] === key) {
            out = out.concat(_fns[key]);
            break
          }
        }

        return out
      }

      function emitAll (e, fns, args) {
        var i = 0;
        var l = fns.length;

        for (i; i < l; i++) {
          if (!fns[i]) break
          fns[i].event = e;
          fns[i].apply(fns[i], args);
        }
      }

      return emitter
    };

    var pad = function pad (num, size) {
      var s = '000000000' + num;
      return s.substr(s.length - size);
    };

    var env = typeof window === 'object' ? window : self;
    var globalCount = Object.keys(env).length;
    var mimeTypesLength = navigator.mimeTypes ? navigator.mimeTypes.length : 0;
    var clientId = pad((mimeTypesLength +
      navigator.userAgent.length).toString(36) +
      globalCount.toString(36), 4);

    var fingerprint_browser = function fingerprint () {
      return clientId;
    };

    var getRandomValue;

    var crypto = typeof window !== 'undefined' &&
      (window.crypto || window.msCrypto) ||
      typeof self !== 'undefined' &&
      self.crypto;

    if (crypto) {
        var lim = Math.pow(2, 32) - 1;
        getRandomValue = function () {
            return Math.abs(crypto.getRandomValues(new Uint32Array(1))[0] / lim);
        };
    } else {
        getRandomValue = Math.random;
    }

    var getRandomValue_browser = getRandomValue;

    /**
     * cuid.js
     * Collision-resistant UID generator for browsers and node.
     * Sequential for fast db lookups and recency sorting.
     * Safe for element IDs and server-side lookups.
     *
     * Extracted from CLCTR
     *
     * Copyright (c) Eric Elliott 2012
     * MIT License
     */





    var c = 0,
      blockSize = 4,
      base = 36,
      discreteValues = Math.pow(base, blockSize);

    function randomBlock () {
      return pad((getRandomValue_browser() *
        discreteValues << 0)
        .toString(base), blockSize);
    }

    function safeCounter () {
      c = c < discreteValues ? c : 0;
      c++; // this is not subliminal
      return c - 1;
    }

    function cuid () {
      // Starting with a lowercase letter makes
      // it HTML element ID friendly.
      var letter = 'c', // hard-coded allows for sequential access

        // timestamp
        // warning: this exposes the exact date and time
        // that the uid was created.
        timestamp = (new Date().getTime()).toString(base),

        // Prevent same-machine collisions.
        counter = pad(safeCounter().toString(base), blockSize),

        // A few chars to generate distinct ids for different
        // clients (so different computers are far less
        // likely to generate the same id)
        print = fingerprint_browser(),

        // Grab some more chars from Math.random()
        random = randomBlock() + randomBlock();

      return letter + timestamp + counter + print + random;
    }

    cuid.slug = function slug () {
      var date = new Date().getTime().toString(36),
        counter = safeCounter().toString(36).slice(-4),
        print = fingerprint_browser().slice(0, 1) +
          fingerprint_browser().slice(-1),
        random = randomBlock().slice(-2);

      return date.slice(-2) +
        counter + print + random;
    };

    cuid.isCuid = function isCuid (stringToCheck) {
      if (typeof stringToCheck !== 'string') return false;
      if (stringToCheck.startsWith('c')) return true;
      return false;
    };

    cuid.isSlug = function isSlug (stringToCheck) {
      if (typeof stringToCheck !== 'string') return false;
      var stringLength = stringToCheck.length;
      if (stringLength >= 7 && stringLength <= 10) return true;
      return false;
    };

    cuid.fingerprint = fingerprint_browser;

    var cuid_1 = cuid;

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function createCommonjsModule(fn, basedir, module) {
    	return module = {
    		path: basedir,
    		exports: {},
    		require: function (path, base) {
    			return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
    		}
    	}, fn(module, module.exports), module.exports;
    }

    function getAugmentedNamespace(n) {
    	if (n.__esModule) return n;
    	var a = Object.defineProperty({}, '__esModule', {value: true});
    	Object.keys(n).forEach(function (k) {
    		var d = Object.getOwnPropertyDescriptor(n, k);
    		Object.defineProperty(a, k, d.get ? d : {
    			enumerable: true,
    			get: function () {
    				return n[k];
    			}
    		});
    	});
    	return a;
    }

    function commonjsRequire () {
    	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
    }

    /**
     * lodash (Custom Build) <https://lodash.com/>
     * Build: `lodash modularize exports="npm" -o ./`
     * Copyright jQuery Foundation and other contributors <https://jquery.org/>
     * Released under MIT license <https://lodash.com/license>
     * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
     * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
     */

    /** Used as the `TypeError` message for "Functions" methods. */
    var FUNC_ERROR_TEXT = 'Expected a function';

    /** Used as references for various `Number` constants. */
    var NAN = 0 / 0;

    /** `Object#toString` result references. */
    var symbolTag = '[object Symbol]';

    /** Used to match leading and trailing whitespace. */
    var reTrim = /^\s+|\s+$/g;

    /** Used to detect bad signed hexadecimal string values. */
    var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

    /** Used to detect binary string values. */
    var reIsBinary = /^0b[01]+$/i;

    /** Used to detect octal string values. */
    var reIsOctal = /^0o[0-7]+$/i;

    /** Built-in method references without a dependency on `root`. */
    var freeParseInt = parseInt;

    /** Detect free variable `global` from Node.js. */
    var freeGlobal = typeof commonjsGlobal == 'object' && commonjsGlobal && commonjsGlobal.Object === Object && commonjsGlobal;

    /** Detect free variable `self`. */
    var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

    /** Used as a reference to the global object. */
    var root = freeGlobal || freeSelf || Function('return this')();

    /** Used for built-in method references. */
    var objectProto = Object.prototype;

    /**
     * Used to resolve the
     * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
     * of values.
     */
    var objectToString = objectProto.toString;

    /* Built-in method references for those with the same name as other `lodash` methods. */
    var nativeMax = Math.max,
        nativeMin = Math.min;

    /**
     * Gets the timestamp of the number of milliseconds that have elapsed since
     * the Unix epoch (1 January 1970 00:00:00 UTC).
     *
     * @static
     * @memberOf _
     * @since 2.4.0
     * @category Date
     * @returns {number} Returns the timestamp.
     * @example
     *
     * _.defer(function(stamp) {
     *   console.log(_.now() - stamp);
     * }, _.now());
     * // => Logs the number of milliseconds it took for the deferred invocation.
     */
    var now = function() {
      return root.Date.now();
    };

    /**
     * Creates a debounced function that delays invoking `func` until after `wait`
     * milliseconds have elapsed since the last time the debounced function was
     * invoked. The debounced function comes with a `cancel` method to cancel
     * delayed `func` invocations and a `flush` method to immediately invoke them.
     * Provide `options` to indicate whether `func` should be invoked on the
     * leading and/or trailing edge of the `wait` timeout. The `func` is invoked
     * with the last arguments provided to the debounced function. Subsequent
     * calls to the debounced function return the result of the last `func`
     * invocation.
     *
     * **Note:** If `leading` and `trailing` options are `true`, `func` is
     * invoked on the trailing edge of the timeout only if the debounced function
     * is invoked more than once during the `wait` timeout.
     *
     * If `wait` is `0` and `leading` is `false`, `func` invocation is deferred
     * until to the next tick, similar to `setTimeout` with a timeout of `0`.
     *
     * See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
     * for details over the differences between `_.debounce` and `_.throttle`.
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Function
     * @param {Function} func The function to debounce.
     * @param {number} [wait=0] The number of milliseconds to delay.
     * @param {Object} [options={}] The options object.
     * @param {boolean} [options.leading=false]
     *  Specify invoking on the leading edge of the timeout.
     * @param {number} [options.maxWait]
     *  The maximum time `func` is allowed to be delayed before it's invoked.
     * @param {boolean} [options.trailing=true]
     *  Specify invoking on the trailing edge of the timeout.
     * @returns {Function} Returns the new debounced function.
     * @example
     *
     * // Avoid costly calculations while the window size is in flux.
     * jQuery(window).on('resize', _.debounce(calculateLayout, 150));
     *
     * // Invoke `sendMail` when clicked, debouncing subsequent calls.
     * jQuery(element).on('click', _.debounce(sendMail, 300, {
     *   'leading': true,
     *   'trailing': false
     * }));
     *
     * // Ensure `batchLog` is invoked once after 1 second of debounced calls.
     * var debounced = _.debounce(batchLog, 250, { 'maxWait': 1000 });
     * var source = new EventSource('/stream');
     * jQuery(source).on('message', debounced);
     *
     * // Cancel the trailing debounced invocation.
     * jQuery(window).on('popstate', debounced.cancel);
     */
    function debounce(func, wait, options) {
      var lastArgs,
          lastThis,
          maxWait,
          result,
          timerId,
          lastCallTime,
          lastInvokeTime = 0,
          leading = false,
          maxing = false,
          trailing = true;

      if (typeof func != 'function') {
        throw new TypeError(FUNC_ERROR_TEXT);
      }
      wait = toNumber(wait) || 0;
      if (isObject(options)) {
        leading = !!options.leading;
        maxing = 'maxWait' in options;
        maxWait = maxing ? nativeMax(toNumber(options.maxWait) || 0, wait) : maxWait;
        trailing = 'trailing' in options ? !!options.trailing : trailing;
      }

      function invokeFunc(time) {
        var args = lastArgs,
            thisArg = lastThis;

        lastArgs = lastThis = undefined;
        lastInvokeTime = time;
        result = func.apply(thisArg, args);
        return result;
      }

      function leadingEdge(time) {
        // Reset any `maxWait` timer.
        lastInvokeTime = time;
        // Start the timer for the trailing edge.
        timerId = setTimeout(timerExpired, wait);
        // Invoke the leading edge.
        return leading ? invokeFunc(time) : result;
      }

      function remainingWait(time) {
        var timeSinceLastCall = time - lastCallTime,
            timeSinceLastInvoke = time - lastInvokeTime,
            result = wait - timeSinceLastCall;

        return maxing ? nativeMin(result, maxWait - timeSinceLastInvoke) : result;
      }

      function shouldInvoke(time) {
        var timeSinceLastCall = time - lastCallTime,
            timeSinceLastInvoke = time - lastInvokeTime;

        // Either this is the first call, activity has stopped and we're at the
        // trailing edge, the system time has gone backwards and we're treating
        // it as the trailing edge, or we've hit the `maxWait` limit.
        return (lastCallTime === undefined || (timeSinceLastCall >= wait) ||
          (timeSinceLastCall < 0) || (maxing && timeSinceLastInvoke >= maxWait));
      }

      function timerExpired() {
        var time = now();
        if (shouldInvoke(time)) {
          return trailingEdge(time);
        }
        // Restart the timer.
        timerId = setTimeout(timerExpired, remainingWait(time));
      }

      function trailingEdge(time) {
        timerId = undefined;

        // Only invoke if we have `lastArgs` which means `func` has been
        // debounced at least once.
        if (trailing && lastArgs) {
          return invokeFunc(time);
        }
        lastArgs = lastThis = undefined;
        return result;
      }

      function cancel() {
        if (timerId !== undefined) {
          clearTimeout(timerId);
        }
        lastInvokeTime = 0;
        lastArgs = lastCallTime = lastThis = timerId = undefined;
      }

      function flush() {
        return timerId === undefined ? result : trailingEdge(now());
      }

      function debounced() {
        var time = now(),
            isInvoking = shouldInvoke(time);

        lastArgs = arguments;
        lastThis = this;
        lastCallTime = time;

        if (isInvoking) {
          if (timerId === undefined) {
            return leadingEdge(lastCallTime);
          }
          if (maxing) {
            // Handle invocations in a tight loop.
            timerId = setTimeout(timerExpired, wait);
            return invokeFunc(lastCallTime);
          }
        }
        if (timerId === undefined) {
          timerId = setTimeout(timerExpired, wait);
        }
        return result;
      }
      debounced.cancel = cancel;
      debounced.flush = flush;
      return debounced;
    }

    /**
     * Creates a throttled function that only invokes `func` at most once per
     * every `wait` milliseconds. The throttled function comes with a `cancel`
     * method to cancel delayed `func` invocations and a `flush` method to
     * immediately invoke them. Provide `options` to indicate whether `func`
     * should be invoked on the leading and/or trailing edge of the `wait`
     * timeout. The `func` is invoked with the last arguments provided to the
     * throttled function. Subsequent calls to the throttled function return the
     * result of the last `func` invocation.
     *
     * **Note:** If `leading` and `trailing` options are `true`, `func` is
     * invoked on the trailing edge of the timeout only if the throttled function
     * is invoked more than once during the `wait` timeout.
     *
     * If `wait` is `0` and `leading` is `false`, `func` invocation is deferred
     * until to the next tick, similar to `setTimeout` with a timeout of `0`.
     *
     * See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
     * for details over the differences between `_.throttle` and `_.debounce`.
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Function
     * @param {Function} func The function to throttle.
     * @param {number} [wait=0] The number of milliseconds to throttle invocations to.
     * @param {Object} [options={}] The options object.
     * @param {boolean} [options.leading=true]
     *  Specify invoking on the leading edge of the timeout.
     * @param {boolean} [options.trailing=true]
     *  Specify invoking on the trailing edge of the timeout.
     * @returns {Function} Returns the new throttled function.
     * @example
     *
     * // Avoid excessively updating the position while scrolling.
     * jQuery(window).on('scroll', _.throttle(updatePosition, 100));
     *
     * // Invoke `renewToken` when the click event is fired, but not more than once every 5 minutes.
     * var throttled = _.throttle(renewToken, 300000, { 'trailing': false });
     * jQuery(element).on('click', throttled);
     *
     * // Cancel the trailing throttled invocation.
     * jQuery(window).on('popstate', throttled.cancel);
     */
    function throttle(func, wait, options) {
      var leading = true,
          trailing = true;

      if (typeof func != 'function') {
        throw new TypeError(FUNC_ERROR_TEXT);
      }
      if (isObject(options)) {
        leading = 'leading' in options ? !!options.leading : leading;
        trailing = 'trailing' in options ? !!options.trailing : trailing;
      }
      return debounce(func, wait, {
        'leading': leading,
        'maxWait': wait,
        'trailing': trailing
      });
    }

    /**
     * Checks if `value` is the
     * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
     * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Lang
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if `value` is an object, else `false`.
     * @example
     *
     * _.isObject({});
     * // => true
     *
     * _.isObject([1, 2, 3]);
     * // => true
     *
     * _.isObject(_.noop);
     * // => true
     *
     * _.isObject(null);
     * // => false
     */
    function isObject(value) {
      var type = typeof value;
      return !!value && (type == 'object' || type == 'function');
    }

    /**
     * Checks if `value` is object-like. A value is object-like if it's not `null`
     * and has a `typeof` result of "object".
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Lang
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
     * @example
     *
     * _.isObjectLike({});
     * // => true
     *
     * _.isObjectLike([1, 2, 3]);
     * // => true
     *
     * _.isObjectLike(_.noop);
     * // => false
     *
     * _.isObjectLike(null);
     * // => false
     */
    function isObjectLike(value) {
      return !!value && typeof value == 'object';
    }

    /**
     * Checks if `value` is classified as a `Symbol` primitive or object.
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Lang
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
     * @example
     *
     * _.isSymbol(Symbol.iterator);
     * // => true
     *
     * _.isSymbol('abc');
     * // => false
     */
    function isSymbol(value) {
      return typeof value == 'symbol' ||
        (isObjectLike(value) && objectToString.call(value) == symbolTag);
    }

    /**
     * Converts `value` to a number.
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Lang
     * @param {*} value The value to process.
     * @returns {number} Returns the number.
     * @example
     *
     * _.toNumber(3.2);
     * // => 3.2
     *
     * _.toNumber(Number.MIN_VALUE);
     * // => 5e-324
     *
     * _.toNumber(Infinity);
     * // => Infinity
     *
     * _.toNumber('3.2');
     * // => 3.2
     */
    function toNumber(value) {
      if (typeof value == 'number') {
        return value;
      }
      if (isSymbol(value)) {
        return NAN;
      }
      if (isObject(value)) {
        var other = typeof value.valueOf == 'function' ? value.valueOf() : value;
        value = isObject(other) ? (other + '') : other;
      }
      if (typeof value != 'string') {
        return value === 0 ? value : +value;
      }
      value = value.replace(reTrim, '');
      var isBinary = reIsBinary.test(value);
      return (isBinary || reIsOctal.test(value))
        ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
        : (reIsBadHex.test(value) ? NAN : +value);
    }

    var lodash_throttle = throttle;

    // Adapted from https://github.com/Flet/prettier-bytes/
    // Changing 1000 bytes to 1024, so we can keep uppercase KB vs kB
    // ISC License (c) Dan Flettre https://github.com/Flet/prettier-bytes/blob/master/LICENSE
    var prettierBytes = function prettierBytes (num) {
      if (typeof num !== 'number' || isNaN(num)) {
        throw new TypeError('Expected a number, got ' + typeof num)
      }

      var neg = num < 0;
      var units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

      if (neg) {
        num = -num;
      }

      if (num < 1) {
        return (neg ? '-' : '') + num + ' B'
      }

      var exponent = Math.min(Math.floor(Math.log(num) / Math.log(1024)), units.length - 1);
      num = Number(num / Math.pow(1024, exponent));
      var unit = units[exponent];

      if (num >= 10 || num % 1 === 0) {
        // Do not show decimals when the number is two-digit, or if the number has no
        // decimal component.
        return (neg ? '-' : '') + num.toFixed(0) + ' ' + unit
      } else {
        return (neg ? '-' : '') + num.toFixed(1) + ' ' + unit
      }
    };

    /* jshint node: true */

    /**
      # wildcard

      Very simple wildcard matching, which is designed to provide the same
      functionality that is found in the
      [eve](https://github.com/adobe-webplatform/eve) eventing library.

      ## Usage

      It works with strings:

      <<< examples/strings.js

      Arrays:

      <<< examples/arrays.js

      Objects (matching against keys):

      <<< examples/objects.js

      While the library works in Node, if you are are looking for file-based
      wildcard matching then you should have a look at:

      <https://github.com/isaacs/node-glob>
    **/

    function WildcardMatcher(text, separator) {
      this.text = text = text || '';
      this.hasWild = ~text.indexOf('*');
      this.separator = separator;
      this.parts = text.split(separator);
    }

    WildcardMatcher.prototype.match = function(input) {
      var matches = true;
      var parts = this.parts;
      var ii;
      var partsCount = parts.length;
      var testParts;

      if (typeof input == 'string' || input instanceof String) {
        if (!this.hasWild && this.text != input) {
          matches = false;
        } else {
          testParts = (input || '').split(this.separator);
          for (ii = 0; matches && ii < partsCount; ii++) {
            if (parts[ii] === '*')  {
              continue;
            } else if (ii < testParts.length) {
              matches = parts[ii] === testParts[ii];
            } else {
              matches = false;
            }
          }

          // If matches, then return the component parts
          matches = matches && testParts;
        }
      }
      else if (typeof input.splice == 'function') {
        matches = [];

        for (ii = input.length; ii--; ) {
          if (this.match(input[ii])) {
            matches[matches.length] = input[ii];
          }
        }
      }
      else if (typeof input == 'object') {
        matches = {};

        for (var key in input) {
          if (this.match(key)) {
            matches[key] = input[key];
          }
        }
      }

      return matches;
    };

    var wildcard = function(text, test, separator) {
      var matcher = new WildcardMatcher(text, separator || /[\/\.]/);
      if (typeof test != 'undefined') {
        return matcher.match(test);
      }

      return matcher;
    };

    var reMimePartSplit = /[\/\+\.]/;

    /**
      # mime-match

      A simple function to checker whether a target mime type matches a mime-type
      pattern (e.g. image/jpeg matches image/jpeg OR image/*).

      ## Example Usage

      <<< example.js

    **/
    var mimeMatch = function(target, pattern) {
      function test(pattern) {
        var result = wildcard(pattern, target, reMimePartSplit);

        // ensure that we have a valid mime type (should have two parts)
        return result && result.length >= 2;
      }

      return pattern ? test(pattern.split(';')[0]) : test;
    };

    function _extends$1() { _extends$1 = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$1.apply(this, arguments); }

    /**
     * Default store that keeps state in a simple object.
     */
    var DefaultStore = /*#__PURE__*/function () {
      function DefaultStore() {
        this.state = {};
        this.callbacks = [];
      }

      var _proto = DefaultStore.prototype;

      _proto.getState = function getState() {
        return this.state;
      };

      _proto.setState = function setState(patch) {
        var prevState = _extends$1({}, this.state);

        var nextState = _extends$1({}, this.state, patch);

        this.state = nextState;

        this._publish(prevState, nextState, patch);
      };

      _proto.subscribe = function subscribe(listener) {
        var _this = this;

        this.callbacks.push(listener);
        return function () {
          // Remove the listener.
          _this.callbacks.splice(_this.callbacks.indexOf(listener), 1);
        };
      };

      _proto._publish = function _publish() {
        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        this.callbacks.forEach(function (listener) {
          listener.apply(void 0, args);
        });
      };

      return DefaultStore;
    }();

    DefaultStore.VERSION = "1.2.6";

    var lib = function defaultStore() {
      return new DefaultStore();
    };

    /**
     * Takes a full filename string and returns an object {name, extension}
     *
     * @param {string} fullFileName
     * @returns {object} {name, extension}
     */
    var getFileNameAndExtension = function getFileNameAndExtension(fullFileName) {
      var lastDot = fullFileName.lastIndexOf('.'); // these count as no extension: "no-dot", "trailing-dot."

      if (lastDot === -1 || lastDot === fullFileName.length - 1) {
        return {
          name: fullFileName,
          extension: undefined
        };
      }

      return {
        name: fullFileName.slice(0, lastDot),
        extension: fullFileName.slice(lastDot + 1)
      };
    };

    // ___Why not add the mime-types package?
    //    It's 19.7kB gzipped, and we only need mime types for well-known extensions (for file previews).
    // ___Where to take new extensions from?
    //    https://github.com/jshttp/mime-db/blob/master/db.json
    var mimeTypes = {
      md: 'text/markdown',
      markdown: 'text/markdown',
      mp4: 'video/mp4',
      mp3: 'audio/mp3',
      svg: 'image/svg+xml',
      jpg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      heic: 'image/heic',
      heif: 'image/heif',
      yaml: 'text/yaml',
      yml: 'text/yaml',
      csv: 'text/csv',
      tsv: 'text/tab-separated-values',
      tab: 'text/tab-separated-values',
      avi: 'video/x-msvideo',
      mks: 'video/x-matroska',
      mkv: 'video/x-matroska',
      mov: 'video/quicktime',
      doc: 'application/msword',
      docm: 'application/vnd.ms-word.document.macroenabled.12',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      dot: 'application/msword',
      dotm: 'application/vnd.ms-word.template.macroenabled.12',
      dotx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
      xla: 'application/vnd.ms-excel',
      xlam: 'application/vnd.ms-excel.addin.macroenabled.12',
      xlc: 'application/vnd.ms-excel',
      xlf: 'application/x-xliff+xml',
      xlm: 'application/vnd.ms-excel',
      xls: 'application/vnd.ms-excel',
      xlsb: 'application/vnd.ms-excel.sheet.binary.macroenabled.12',
      xlsm: 'application/vnd.ms-excel.sheet.macroenabled.12',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xlt: 'application/vnd.ms-excel',
      xltm: 'application/vnd.ms-excel.template.macroenabled.12',
      xltx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
      xlw: 'application/vnd.ms-excel',
      txt: 'text/plain',
      text: 'text/plain',
      conf: 'text/plain',
      log: 'text/plain',
      pdf: 'application/pdf',
      zip: 'application/zip',
      '7z': 'application/x-7z-compressed',
      rar: 'application/x-rar-compressed',
      tar: 'application/x-tar',
      gz: 'application/gzip',
      dmg: 'application/x-apple-diskimage'
    };

    var getFileType = function getFileType(file) {
      var fileExtension = file.name ? getFileNameAndExtension(file.name).extension : null;
      fileExtension = fileExtension ? fileExtension.toLowerCase() : null;

      if (file.type) {
        // if mime type is set in the file object already, use that
        return file.type;
      }

      if (fileExtension && mimeTypes[fileExtension]) {
        // else, see if we can map extension to a mime type
        return mimeTypes[fileExtension];
      } // if all fails, fall back to a generic byte stream type


      return 'application/octet-stream';
    };

    /**
     * Takes a file object and turns it into fileID, by converting file.name to lowercase,
     * removing extra characters and adding type, size and lastModified
     *
     * @param {object} file
     * @returns {string} the fileID
     */
    var generateFileID = function generateFileID(file) {
      // It's tempting to do `[items].filter(Boolean).join('-')` here, but that
      // is slower! simple string concatenation is fast
      var id = 'uppy';

      if (typeof file.name === 'string') {
        id += "-" + encodeFilename(file.name.toLowerCase());
      }

      if (file.type !== undefined) {
        id += "-" + file.type;
      }

      if (file.meta && typeof file.meta.relativePath === 'string') {
        id += "-" + encodeFilename(file.meta.relativePath.toLowerCase());
      }

      if (file.data.size !== undefined) {
        id += "-" + file.data.size;
      }

      if (file.data.lastModified !== undefined) {
        id += "-" + file.data.lastModified;
      }

      return id;
    };

    function encodeFilename(name) {
      var suffix = '';
      return name.replace(/[^A-Z0-9]/ig, function (character) {
        suffix += "-" + encodeCharacter(character);
        return '/';
      }) + suffix;
    }

    function encodeCharacter(character) {
      return character.charCodeAt(0).toString(32);
    }

    /**
     * Array.prototype.findIndex ponyfill for old browsers.
     *
     * @param {Array} array
     * @param {Function} predicate
     * @returns {number}
     */
    var findIndex = function findIndex(array, predicate) {
      for (var i = 0; i < array.length; i++) {
        if (predicate(array[i])) return i;
      }

      return -1;
    };

    // Edge 15.x does not fire 'progress' events on uploads.
    // See https://github.com/transloadit/uppy/issues/945
    // And https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/12224510/
    var supportsUploadProgress = function supportsUploadProgress(userAgent) {
      // Allow passing in userAgent for tests
      if (userAgent == null) {
        userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;
      } // Assume it works because basically everything supports progress events.


      if (!userAgent) return true;
      var m = /Edge\/(\d+\.\d+)/.exec(userAgent);
      if (!m) return true;
      var edgeVersion = m[1];

      var _edgeVersion$split = edgeVersion.split('.'),
          major = _edgeVersion$split[0],
          minor = _edgeVersion$split[1];

      major = parseInt(major, 10);
      minor = parseInt(minor, 10); // Worked before:
      // Edge 40.15063.0.0
      // Microsoft EdgeHTML 15.15063

      if (major < 15 || major === 15 && minor < 15063) {
        return true;
      } // Fixed in:
      // Microsoft EdgeHTML 18.18218


      if (major > 18 || major === 18 && minor >= 18218) {
        return true;
      } // other versions don't work.


      return false;
    };

    /**
     * Returns a timestamp in the format of `hours:minutes:seconds`
     */
    var getTimeStamp = function getTimeStamp() {
      var date = new Date();
      var hours = pad$1(date.getHours().toString());
      var minutes = pad$1(date.getMinutes().toString());
      var seconds = pad$1(date.getSeconds().toString());
      return hours + ":" + minutes + ":" + seconds;
    };
    /**
     * Adds zero to strings shorter than two characters
     */


    function pad$1(str) {
      return str.length !== 2 ? 0 + str : str;
    }

    // Swallow all logs, except errors.
    // default if logger is not set or debug: false


    var justErrorsLogger = {
      debug: function debug() {},
      warn: function warn() {},
      error: function error() {
        var _console;

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        return (_console = console).error.apply(_console, ["[Uppy] [" + getTimeStamp() + "]"].concat(args));
      }
    }; // Print logs to console with namespace + timestamp,
    // set by logger: Uppy.debugLogger or debug: true

    var debugLogger = {
      debug: function debug() {
        // IE 10 doesn’t support console.debug
        var debug = console.debug || console.log;

        for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
          args[_key2] = arguments[_key2];
        }

        debug.call.apply(debug, [console, "[Uppy] [" + getTimeStamp() + "]"].concat(args));
      },
      warn: function warn() {
        var _console2;

        for (var _len3 = arguments.length, args = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
          args[_key3] = arguments[_key3];
        }

        return (_console2 = console).warn.apply(_console2, ["[Uppy] [" + getTimeStamp() + "]"].concat(args));
      },
      error: function error() {
        var _console3;

        for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
          args[_key4] = arguments[_key4];
        }

        return (_console3 = console).error.apply(_console3, ["[Uppy] [" + getTimeStamp() + "]"].concat(args));
      }
    };
    var loggers = {
      justErrorsLogger: justErrorsLogger,
      debugLogger: debugLogger
    };

    /**
     * Check if an object is a DOM element. Duck-typing based on `nodeType`.
     *
     * @param {*} obj
     */
    var isDOMElement = function isDOMElement(obj) {
      return obj && typeof obj === 'object' && obj.nodeType === Node.ELEMENT_NODE;
    };

    /**
     * Find a DOM element.
     *
     * @param {Node|string} element
     * @returns {Node|null}
     */


    var findDOMElement = function findDOMElement(element, context) {
      if (context === void 0) {
        context = document;
      }

      if (typeof element === 'string') {
        return context.querySelector(element);
      }

      if (isDOMElement(element)) {
        return element;
      }
    };

    var _require2 = /*@__PURE__*/getAugmentedNamespace(preact_esm);

    function _extends$2() { _extends$2 = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$2.apply(this, arguments); }




    /**
     * Defer a frequent call to the microtask queue.
     */


    function debounce$1(fn) {
      var calling = null;
      var latestArgs = null;
      return function () {
        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        latestArgs = args;

        if (!calling) {
          calling = Promise.resolve().then(function () {
            calling = null; // At this point `args` may be different from the most
            // recent state, if multiple calls happened since this task
            // was queued. So we use the `latestArgs`, which definitely
            // is the most recent call.

            return fn.apply(void 0, latestArgs);
          });
        }

        return calling;
      };
    }
    /**
     * Boilerplate that all Plugins share - and should not be used
     * directly. It also shows which methods final plugins should implement/override,
     * this deciding on structure.
     *
     * @param {object} main Uppy core object
     * @param {object} object with plugin options
     * @returns {Array|string} files or success/fail message
     */


    var Plugin = /*#__PURE__*/function () {
      function Plugin(uppy, opts) {
        this.uppy = uppy;
        this.opts = opts || {};
        this.update = this.update.bind(this);
        this.mount = this.mount.bind(this);
        this.install = this.install.bind(this);
        this.uninstall = this.uninstall.bind(this);
      }

      var _proto = Plugin.prototype;

      _proto.getPluginState = function getPluginState() {
        var _this$uppy$getState = this.uppy.getState(),
            plugins = _this$uppy$getState.plugins;

        return plugins[this.id] || {};
      };

      _proto.setPluginState = function setPluginState(update) {
        var _extends2;

        var _this$uppy$getState2 = this.uppy.getState(),
            plugins = _this$uppy$getState2.plugins;

        this.uppy.setState({
          plugins: _extends$2({}, plugins, (_extends2 = {}, _extends2[this.id] = _extends$2({}, plugins[this.id], update), _extends2))
        });
      };

      _proto.setOptions = function setOptions(newOpts) {
        this.opts = _extends$2({}, this.opts, newOpts);
        this.setPluginState(); // so that UI re-renders with new options
      };

      _proto.update = function update(state) {
        if (typeof this.el === 'undefined') {
          return;
        }

        if (this._updateUI) {
          this._updateUI(state);
        }
      } // Called after every state update, after everything's mounted. Debounced.
      ;

      _proto.afterUpdate = function afterUpdate() {}
      /**
       * Called when plugin is mounted, whether in DOM or into another plugin.
       * Needed because sometimes plugins are mounted separately/after `install`,
       * so this.el and this.parent might not be available in `install`.
       * This is the case with @uppy/react plugins, for example.
       */
      ;

      _proto.onMount = function onMount() {}
      /**
       * Check if supplied `target` is a DOM element or an `object`.
       * If it’s an object — target is a plugin, and we search `plugins`
       * for a plugin with same name and return its target.
       *
       * @param {string|object} target
       *
       */
      ;

      _proto.mount = function mount(target, plugin) {
        var _this = this;

        var callerPluginName = plugin.id;
        var targetElement = findDOMElement(target);

        if (targetElement) {
          this.isTargetDOMEl = true; // API for plugins that require a synchronous rerender.

          this.rerender = function (state) {
            // plugin could be removed, but this.rerender is debounced below,
            // so it could still be called even after uppy.removePlugin or uppy.close
            // hence the check
            if (!_this.uppy.getPlugin(_this.id)) return;
            _this.el = _require2.render(_this.render(state), targetElement, _this.el);

            _this.afterUpdate();
          };

          this._updateUI = debounce$1(this.rerender);
          this.uppy.log("Installing " + callerPluginName + " to a DOM element '" + target + "'"); // clear everything inside the target container

          if (this.opts.replaceTargetContent) {
            targetElement.innerHTML = '';
          }

          this.el = _require2.render(this.render(this.uppy.getState()), targetElement);
          this.onMount();
          return this.el;
        }

        var targetPlugin;

        if (typeof target === 'object' && target instanceof Plugin) {
          // Targeting a plugin *instance*
          targetPlugin = target;
        } else if (typeof target === 'function') {
          // Targeting a plugin type
          var Target = target; // Find the target plugin instance.

          this.uppy.iteratePlugins(function (plugin) {
            if (plugin instanceof Target) {
              targetPlugin = plugin;
              return false;
            }
          });
        }

        if (targetPlugin) {
          this.uppy.log("Installing " + callerPluginName + " to " + targetPlugin.id);
          this.parent = targetPlugin;
          this.el = targetPlugin.addTarget(plugin);
          this.onMount();
          return this.el;
        }

        this.uppy.log("Not installing " + callerPluginName);
        var message = "Invalid target option given to " + callerPluginName + ".";

        if (typeof target === 'function') {
          message += ' The given target is not a Plugin class. ' + 'Please check that you\'re not specifying a React Component instead of a plugin. ' + 'If you are using @uppy/* packages directly, make sure you have only 1 version of @uppy/core installed: ' + 'run `npm ls @uppy/core` on the command line and verify that all the versions match and are deduped correctly.';
        } else {
          message += 'If you meant to target an HTML element, please make sure that the element exists. ' + 'Check that the <script> tag initializing Uppy is right before the closing </body> tag at the end of the page. ' + '(see https://github.com/transloadit/uppy/issues/1042)\n\n' + 'If you meant to target a plugin, please confirm that your `import` statements or `require` calls are correct.';
        }

        throw new Error(message);
      };

      _proto.render = function render(state) {
        throw new Error('Extend the render method to add your plugin to a DOM element');
      };

      _proto.addTarget = function addTarget(plugin) {
        throw new Error('Extend the addTarget method to add your plugin to another plugin\'s target');
      };

      _proto.unmount = function unmount() {
        if (this.isTargetDOMEl && this.el && this.el.parentNode) {
          this.el.parentNode.removeChild(this.el);
        }
      };

      _proto.install = function install() {};

      _proto.uninstall = function uninstall() {
        this.unmount();
      };

      return Plugin;
    }();

    function _extends$3() { _extends$3 = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$3.apply(this, arguments); }

    function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

    function _inheritsLoose(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; _setPrototypeOf(subClass, superClass); }

    function _wrapNativeSuper(Class) { var _cache = typeof Map === "function" ? new Map() : undefined; _wrapNativeSuper = function _wrapNativeSuper(Class) { if (Class === null || !_isNativeFunction(Class)) return Class; if (typeof Class !== "function") { throw new TypeError("Super expression must either be null or a function"); } if (typeof _cache !== "undefined") { if (_cache.has(Class)) return _cache.get(Class); _cache.set(Class, Wrapper); } function Wrapper() { return _construct(Class, arguments, _getPrototypeOf(this).constructor); } Wrapper.prototype = Object.create(Class.prototype, { constructor: { value: Wrapper, enumerable: false, writable: true, configurable: true } }); return _setPrototypeOf(Wrapper, Class); }; return _wrapNativeSuper(Class); }

    function _construct(Parent, args, Class) { if (_isNativeReflectConstruct()) { _construct = Reflect.construct; } else { _construct = function _construct(Parent, args, Class) { var a = [null]; a.push.apply(a, args); var Constructor = Function.bind.apply(Parent, a); var instance = new Constructor(); if (Class) _setPrototypeOf(instance, Class.prototype); return instance; }; } return _construct.apply(null, arguments); }

    function _isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _isNativeFunction(fn) { return Function.toString.call(fn).indexOf("[native code]") !== -1; }

    function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

    function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

    /* global AggregateError */
























    var justErrorsLogger$1 = loggers.justErrorsLogger,
        debugLogger$1 = loggers.debugLogger;

     // Exported from here.


    var RestrictionError = /*#__PURE__*/function (_Error) {
      _inheritsLoose(RestrictionError, _Error);

      function RestrictionError() {
        var _this;

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _Error.call.apply(_Error, [this].concat(args)) || this;
        _this.isRestriction = true;
        return _this;
      }

      return RestrictionError;
    }( /*#__PURE__*/_wrapNativeSuper(Error));
    /**
     * Uppy Core module.
     * Manages plugins, state updates, acts as an event bus,
     * adds/removes files and metadata.
     */


    var Uppy = /*#__PURE__*/function () {
      /**
       * Instantiate Uppy
       *
       * @param {object} opts — Uppy options
       */
      function Uppy(opts) {
        var _this2 = this;

        this.defaultLocale = {
          strings: {
            addBulkFilesFailed: {
              0: 'Failed to add %{smart_count} file due to an internal error',
              1: 'Failed to add %{smart_count} files due to internal errors'
            },
            youCanOnlyUploadX: {
              0: 'You can only upload %{smart_count} file',
              1: 'You can only upload %{smart_count} files'
            },
            youHaveToAtLeastSelectX: {
              0: 'You have to select at least %{smart_count} file',
              1: 'You have to select at least %{smart_count} files'
            },
            // The default `exceedsSize2` string only combines the `exceedsSize` string (%{backwardsCompat}) with the size.
            // Locales can override `exceedsSize2` to specify a different word order. This is for backwards compat with
            // Uppy 1.9.x and below which did a naive concatenation of `exceedsSize2 + size` instead of using a locale-specific
            // substitution.
            // TODO: In 2.0 `exceedsSize2` should be removed in and `exceedsSize` updated to use substitution.
            exceedsSize2: '%{backwardsCompat} %{size}',
            exceedsSize: 'This file exceeds maximum allowed size of',
            inferiorSize: 'This file is smaller than the allowed size of %{size}',
            youCanOnlyUploadFileTypes: 'You can only upload: %{types}',
            noNewAlreadyUploading: 'Cannot add new files: already uploading',
            noDuplicates: 'Cannot add the duplicate file \'%{fileName}\', it already exists',
            companionError: 'Connection with Companion failed',
            companionUnauthorizeHint: 'To unauthorize to your %{provider} account, please go to %{url}',
            failedToUpload: 'Failed to upload %{file}',
            noInternetConnection: 'No Internet connection',
            connectedToInternet: 'Connected to the Internet',
            // Strings for remote providers
            noFilesFound: 'You have no files or folders here',
            selectX: {
              0: 'Select %{smart_count}',
              1: 'Select %{smart_count}'
            },
            selectAllFilesFromFolderNamed: 'Select all files from folder %{name}',
            unselectAllFilesFromFolderNamed: 'Unselect all files from folder %{name}',
            selectFileNamed: 'Select file %{name}',
            unselectFileNamed: 'Unselect file %{name}',
            openFolderNamed: 'Open folder %{name}',
            cancel: 'Cancel',
            logOut: 'Log out',
            filter: 'Filter',
            resetFilter: 'Reset filter',
            loading: 'Loading...',
            authenticateWithTitle: 'Please authenticate with %{pluginName} to select files',
            authenticateWith: 'Connect to %{pluginName}',
            searchImages: 'Search for images',
            enterTextToSearch: 'Enter text to search for images',
            backToSearch: 'Back to Search',
            emptyFolderAdded: 'No files were added from empty folder',
            folderAdded: {
              0: 'Added %{smart_count} file from %{folder}',
              1: 'Added %{smart_count} files from %{folder}'
            }
          }
        };
        var defaultOptions = {
          id: 'uppy',
          autoProceed: false,
          allowMultipleUploads: true,
          debug: false,
          restrictions: {
            maxFileSize: null,
            minFileSize: null,
            maxTotalFileSize: null,
            maxNumberOfFiles: null,
            minNumberOfFiles: null,
            allowedFileTypes: null
          },
          meta: {},
          onBeforeFileAdded: function onBeforeFileAdded(currentFile, files) {
            return currentFile;
          },
          onBeforeUpload: function onBeforeUpload(files) {
            return files;
          },
          store: lib(),
          logger: justErrorsLogger$1,
          infoTimeout: 5000
        }; // Merge default options with the ones set by user,
        // making sure to merge restrictions too

        this.opts = _extends$3({}, defaultOptions, opts, {
          restrictions: _extends$3({}, defaultOptions.restrictions, opts && opts.restrictions)
        }); // Support debug: true for backwards-compatability, unless logger is set in opts
        // opts instead of this.opts to avoid comparing objects — we set logger: justErrorsLogger in defaultOptions

        if (opts && opts.logger && opts.debug) {
          this.log('You are using a custom `logger`, but also set `debug: true`, which uses built-in logger to output logs to console. Ignoring `debug: true` and using your custom `logger`.', 'warning');
        } else if (opts && opts.debug) {
          this.opts.logger = debugLogger$1;
        }

        this.log("Using Core v" + this.constructor.VERSION);

        if (this.opts.restrictions.allowedFileTypes && this.opts.restrictions.allowedFileTypes !== null && !Array.isArray(this.opts.restrictions.allowedFileTypes)) {
          throw new TypeError('`restrictions.allowedFileTypes` must be an array');
        }

        this.i18nInit(); // Container for different types of plugins

        this.plugins = {};
        this.getState = this.getState.bind(this);
        this.getPlugin = this.getPlugin.bind(this);
        this.setFileMeta = this.setFileMeta.bind(this);
        this.setFileState = this.setFileState.bind(this);
        this.log = this.log.bind(this);
        this.info = this.info.bind(this);
        this.hideInfo = this.hideInfo.bind(this);
        this.addFile = this.addFile.bind(this);
        this.removeFile = this.removeFile.bind(this);
        this.pauseResume = this.pauseResume.bind(this);
        this.validateRestrictions = this.validateRestrictions.bind(this); // ___Why throttle at 500ms?
        //    - We must throttle at >250ms for superfocus in Dashboard to work well (because animation takes 0.25s, and we want to wait for all animations to be over before refocusing).
        //    [Practical Check]: if thottle is at 100ms, then if you are uploading a file, and click 'ADD MORE FILES', - focus won't activate in Firefox.
        //    - We must throttle at around >500ms to avoid performance lags.
        //    [Practical Check] Firefox, try to upload a big file for a prolonged period of time. Laptop will start to heat up.

        this._calculateProgress = lodash_throttle(this._calculateProgress.bind(this), 500, {
          leading: true,
          trailing: true
        });
        this.updateOnlineStatus = this.updateOnlineStatus.bind(this);
        this.resetProgress = this.resetProgress.bind(this);
        this.pauseAll = this.pauseAll.bind(this);
        this.resumeAll = this.resumeAll.bind(this);
        this.retryAll = this.retryAll.bind(this);
        this.cancelAll = this.cancelAll.bind(this);
        this.retryUpload = this.retryUpload.bind(this);
        this.upload = this.upload.bind(this);
        this.emitter = namespaceEmitter();
        this.on = this.on.bind(this);
        this.off = this.off.bind(this);
        this.once = this.emitter.once.bind(this.emitter);
        this.emit = this.emitter.emit.bind(this.emitter);
        this.preProcessors = [];
        this.uploaders = [];
        this.postProcessors = [];
        this.store = this.opts.store;
        this.setState({
          plugins: {},
          files: {},
          currentUploads: {},
          allowNewUpload: true,
          capabilities: {
            uploadProgress: supportsUploadProgress(),
            individualCancellation: true,
            resumableUploads: false
          },
          totalProgress: 0,
          meta: _extends$3({}, this.opts.meta),
          info: {
            isHidden: true,
            type: 'info',
            message: ''
          }
        });
        this._storeUnsubscribe = this.store.subscribe(function (prevState, nextState, patch) {
          _this2.emit('state-update', prevState, nextState, patch);

          _this2.updateAll(nextState);
        }); // Exposing uppy object on window for debugging and testing

        if (this.opts.debug && typeof window !== 'undefined') {
          window[this.opts.id] = this;
        }

        this._addListeners(); // Re-enable if we’ll need some capabilities on boot, like isMobileDevice
        // this._setCapabilities()

      } // _setCapabilities = () => {
      //   const capabilities = {
      //     isMobileDevice: isMobileDevice()
      //   }
      //   this.setState({
      //     ...this.getState().capabilities,
      //     capabilities
      //   })
      // }


      var _proto = Uppy.prototype;

      _proto.on = function on(event, callback) {
        this.emitter.on(event, callback);
        return this;
      };

      _proto.off = function off(event, callback) {
        this.emitter.off(event, callback);
        return this;
      }
      /**
       * Iterate on all plugins and run `update` on them.
       * Called each time state changes.
       *
       */
      ;

      _proto.updateAll = function updateAll(state) {
        this.iteratePlugins(function (plugin) {
          plugin.update(state);
        });
      }
      /**
       * Updates state with a patch
       *
       * @param {object} patch {foo: 'bar'}
       */
      ;

      _proto.setState = function setState(patch) {
        this.store.setState(patch);
      }
      /**
       * Returns current state.
       *
       * @returns {object}
       */
      ;

      _proto.getState = function getState() {
        return this.store.getState();
      }
      /**
       * Back compat for when uppy.state is used instead of uppy.getState().
       */
      ;

      /**
       * Shorthand to set state for a specific file.
       */
      _proto.setFileState = function setFileState(fileID, state) {
        var _extends2;

        if (!this.getState().files[fileID]) {
          throw new Error("Can\u2019t set state for " + fileID + " (the file could have been removed)");
        }

        this.setState({
          files: _extends$3({}, this.getState().files, (_extends2 = {}, _extends2[fileID] = _extends$3({}, this.getState().files[fileID], state), _extends2))
        });
      };

      _proto.i18nInit = function i18nInit() {
        this.translator = new Translator([this.defaultLocale, this.opts.locale]);
        this.locale = this.translator.locale;
        this.i18n = this.translator.translate.bind(this.translator);
        this.i18nArray = this.translator.translateArray.bind(this.translator);
      };

      _proto.setOptions = function setOptions(newOpts) {
        this.opts = _extends$3({}, this.opts, newOpts, {
          restrictions: _extends$3({}, this.opts.restrictions, newOpts && newOpts.restrictions)
        });

        if (newOpts.meta) {
          this.setMeta(newOpts.meta);
        }

        this.i18nInit();

        if (newOpts.locale) {
          this.iteratePlugins(function (plugin) {
            plugin.setOptions();
          });
        }

        this.setState(); // so that UI re-renders with new options
      };

      _proto.resetProgress = function resetProgress() {
        var defaultProgress = {
          percentage: 0,
          bytesUploaded: 0,
          uploadComplete: false,
          uploadStarted: null
        };

        var files = _extends$3({}, this.getState().files);

        var updatedFiles = {};
        Object.keys(files).forEach(function (fileID) {
          var updatedFile = _extends$3({}, files[fileID]);

          updatedFile.progress = _extends$3({}, updatedFile.progress, defaultProgress);
          updatedFiles[fileID] = updatedFile;
        });
        this.setState({
          files: updatedFiles,
          totalProgress: 0
        });
        this.emit('reset-progress');
      };

      _proto.addPreProcessor = function addPreProcessor(fn) {
        this.preProcessors.push(fn);
      };

      _proto.removePreProcessor = function removePreProcessor(fn) {
        var i = this.preProcessors.indexOf(fn);

        if (i !== -1) {
          this.preProcessors.splice(i, 1);
        }
      };

      _proto.addPostProcessor = function addPostProcessor(fn) {
        this.postProcessors.push(fn);
      };

      _proto.removePostProcessor = function removePostProcessor(fn) {
        var i = this.postProcessors.indexOf(fn);

        if (i !== -1) {
          this.postProcessors.splice(i, 1);
        }
      };

      _proto.addUploader = function addUploader(fn) {
        this.uploaders.push(fn);
      };

      _proto.removeUploader = function removeUploader(fn) {
        var i = this.uploaders.indexOf(fn);

        if (i !== -1) {
          this.uploaders.splice(i, 1);
        }
      };

      _proto.setMeta = function setMeta(data) {
        var updatedMeta = _extends$3({}, this.getState().meta, data);

        var updatedFiles = _extends$3({}, this.getState().files);

        Object.keys(updatedFiles).forEach(function (fileID) {
          updatedFiles[fileID] = _extends$3({}, updatedFiles[fileID], {
            meta: _extends$3({}, updatedFiles[fileID].meta, data)
          });
        });
        this.log('Adding metadata:');
        this.log(data);
        this.setState({
          meta: updatedMeta,
          files: updatedFiles
        });
      };

      _proto.setFileMeta = function setFileMeta(fileID, data) {
        var updatedFiles = _extends$3({}, this.getState().files);

        if (!updatedFiles[fileID]) {
          this.log('Was trying to set metadata for a file that has been removed: ', fileID);
          return;
        }

        var newMeta = _extends$3({}, updatedFiles[fileID].meta, data);

        updatedFiles[fileID] = _extends$3({}, updatedFiles[fileID], {
          meta: newMeta
        });
        this.setState({
          files: updatedFiles
        });
      }
      /**
       * Get a file object.
       *
       * @param {string} fileID The ID of the file object to return.
       */
      ;

      _proto.getFile = function getFile(fileID) {
        return this.getState().files[fileID];
      }
      /**
       * Get all files in an array.
       */
      ;

      _proto.getFiles = function getFiles() {
        var _this$getState = this.getState(),
            files = _this$getState.files;

        return Object.keys(files).map(function (fileID) {
          return files[fileID];
        });
      }
      /**
       * A public wrapper for _checkRestrictions — checks if a file passes a set of restrictions.
       * For use in UI pluigins (like Providers), to disallow selecting files that won’t pass restrictions.
       *
       * @param {object} file object to check
       * @param {Array} [files] array to check maxNumberOfFiles and maxTotalFileSize
       * @returns {object} { result: true/false, reason: why file didn’t pass restrictions }
       */
      ;

      _proto.validateRestrictions = function validateRestrictions(file, files) {
        try {
          this._checkRestrictions(file, files);

          return {
            result: true
          };
        } catch (err) {
          return {
            result: false,
            reason: err.message
          };
        }
      }
      /**
       * Check if file passes a set of restrictions set in options: maxFileSize, minFileSize,
       * maxNumberOfFiles and allowedFileTypes.
       *
       * @param {object} file object to check
       * @param {Array} [files] array to check maxNumberOfFiles and maxTotalFileSize
       * @private
       */
      ;

      _proto._checkRestrictions = function _checkRestrictions(file, files) {
        if (files === void 0) {
          files = this.getFiles();
        }

        var _this$opts$restrictio = this.opts.restrictions,
            maxFileSize = _this$opts$restrictio.maxFileSize,
            minFileSize = _this$opts$restrictio.minFileSize,
            maxTotalFileSize = _this$opts$restrictio.maxTotalFileSize,
            maxNumberOfFiles = _this$opts$restrictio.maxNumberOfFiles,
            allowedFileTypes = _this$opts$restrictio.allowedFileTypes;

        if (maxNumberOfFiles) {
          if (files.length + 1 > maxNumberOfFiles) {
            throw new RestrictionError("" + this.i18n('youCanOnlyUploadX', {
              smart_count: maxNumberOfFiles
            }));
          }
        }

        if (allowedFileTypes) {
          var isCorrectFileType = allowedFileTypes.some(function (type) {
            // check if this is a mime-type
            if (type.indexOf('/') > -1) {
              if (!file.type) return false;
              return mimeMatch(file.type.replace(/;.*?$/, ''), type);
            } // otherwise this is likely an extension


            if (type[0] === '.' && file.extension) {
              return file.extension.toLowerCase() === type.substr(1).toLowerCase();
            }

            return false;
          });

          if (!isCorrectFileType) {
            var allowedFileTypesString = allowedFileTypes.join(', ');
            throw new RestrictionError(this.i18n('youCanOnlyUploadFileTypes', {
              types: allowedFileTypesString
            }));
          }
        } // We can't check maxTotalFileSize if the size is unknown.


        if (maxTotalFileSize && file.size != null) {
          var totalFilesSize = 0;
          totalFilesSize += file.size;
          files.forEach(function (file) {
            totalFilesSize += file.size;
          });

          if (totalFilesSize > maxTotalFileSize) {
            throw new RestrictionError(this.i18n('exceedsSize2', {
              backwardsCompat: this.i18n('exceedsSize'),
              size: prettierBytes(maxTotalFileSize)
            }));
          }
        } // We can't check maxFileSize if the size is unknown.


        if (maxFileSize && file.size != null) {
          if (file.size > maxFileSize) {
            throw new RestrictionError(this.i18n('exceedsSize2', {
              backwardsCompat: this.i18n('exceedsSize'),
              size: prettierBytes(maxFileSize)
            }));
          }
        } // We can't check minFileSize if the size is unknown.


        if (minFileSize && file.size != null) {
          if (file.size < minFileSize) {
            throw new RestrictionError(this.i18n('inferiorSize', {
              size: prettierBytes(minFileSize)
            }));
          }
        }
      }
      /**
       * Check if minNumberOfFiles restriction is reached before uploading.
       *
       * @private
       */
      ;

      _proto._checkMinNumberOfFiles = function _checkMinNumberOfFiles(files) {
        var minNumberOfFiles = this.opts.restrictions.minNumberOfFiles;

        if (Object.keys(files).length < minNumberOfFiles) {
          throw new RestrictionError("" + this.i18n('youHaveToAtLeastSelectX', {
            smart_count: minNumberOfFiles
          }));
        }
      }
      /**
       * Logs an error, sets Informer message, then throws the error.
       * Emits a 'restriction-failed' event if it’s a restriction error
       *
       * @param {object | string} err — Error object or plain string message
       * @param {object} [options]
       * @param {boolean} [options.showInformer=true] — Sometimes developer might want to show Informer manually
       * @param {object} [options.file=null] — File object used to emit the restriction error
       * @param {boolean} [options.throwErr=true] — Errors shouldn’t be thrown, for example, in `upload-error` event
       * @private
       */
      ;

      _proto._showOrLogErrorAndThrow = function _showOrLogErrorAndThrow(err, _temp) {
        var _ref = _temp === void 0 ? {} : _temp,
            _ref$showInformer = _ref.showInformer,
            showInformer = _ref$showInformer === void 0 ? true : _ref$showInformer,
            _ref$file = _ref.file,
            file = _ref$file === void 0 ? null : _ref$file,
            _ref$throwErr = _ref.throwErr,
            throwErr = _ref$throwErr === void 0 ? true : _ref$throwErr;

        var message = typeof err === 'object' ? err.message : err;
        var details = typeof err === 'object' && err.details ? err.details : ''; // Restriction errors should be logged, but not as errors,
        // as they are expected and shown in the UI.

        var logMessageWithDetails = message;

        if (details) {
          logMessageWithDetails += " " + details;
        }

        if (err.isRestriction) {
          this.log(logMessageWithDetails);
          this.emit('restriction-failed', file, err);
        } else {
          this.log(logMessageWithDetails, 'error');
        } // Sometimes informer has to be shown manually by the developer,
        // for example, in `onBeforeFileAdded`.


        if (showInformer) {
          this.info({
            message: message,
            details: details
          }, 'error', this.opts.infoTimeout);
        }

        if (throwErr) {
          throw typeof err === 'object' ? err : new Error(err);
        }
      };

      _proto._assertNewUploadAllowed = function _assertNewUploadAllowed(file) {
        var _this$getState2 = this.getState(),
            allowNewUpload = _this$getState2.allowNewUpload;

        if (allowNewUpload === false) {
          this._showOrLogErrorAndThrow(new RestrictionError(this.i18n('noNewAlreadyUploading')), {
            file: file
          });
        }
      }
      /**
       * Create a file state object based on user-provided `addFile()` options.
       *
       * Note this is extremely side-effectful and should only be done when a file state object will be added to state immediately afterward!
       *
       * The `files` value is passed in because it may be updated by the caller without updating the store.
       */
      ;

      _proto._checkAndCreateFileStateObject = function _checkAndCreateFileStateObject(files, file) {
        var fileType = getFileType(file);
        file.type = fileType;
        var onBeforeFileAddedResult = this.opts.onBeforeFileAdded(file, files);

        if (onBeforeFileAddedResult === false) {
          // Don’t show UI info for this error, as it should be done by the developer
          this._showOrLogErrorAndThrow(new RestrictionError('Cannot add the file because onBeforeFileAdded returned false.'), {
            showInformer: false,
            file: file
          });
        }

        if (typeof onBeforeFileAddedResult === 'object' && onBeforeFileAddedResult) {
          file = onBeforeFileAddedResult;
        }

        var fileName;

        if (file.name) {
          fileName = file.name;
        } else if (fileType.split('/')[0] === 'image') {
          fileName = fileType.split('/')[0] + "." + fileType.split('/')[1];
        } else {
          fileName = 'noname';
        }

        var fileExtension = getFileNameAndExtension(fileName).extension;
        var isRemote = file.isRemote || false;
        var fileID = generateFileID(file);

        if (files[fileID]) {
          this._showOrLogErrorAndThrow(new RestrictionError(this.i18n('noDuplicates', {
            fileName: fileName
          })), {
            file: file
          });
        }

        var meta = file.meta || {};
        meta.name = fileName;
        meta.type = fileType; // `null` means the size is unknown.

        var size = isFinite(file.data.size) ? file.data.size : null;
        var newFile = {
          source: file.source || '',
          id: fileID,
          name: fileName,
          extension: fileExtension || '',
          meta: _extends$3({}, this.getState().meta, meta),
          type: fileType,
          data: file.data,
          progress: {
            percentage: 0,
            bytesUploaded: 0,
            bytesTotal: size,
            uploadComplete: false,
            uploadStarted: null
          },
          size: size,
          isRemote: isRemote,
          remote: file.remote || '',
          preview: file.preview
        };

        try {
          var filesArray = Object.keys(files).map(function (i) {
            return files[i];
          });

          this._checkRestrictions(newFile, filesArray);
        } catch (err) {
          this._showOrLogErrorAndThrow(err, {
            file: newFile
          });
        }

        return newFile;
      } // Schedule an upload if `autoProceed` is enabled.
      ;

      _proto._startIfAutoProceed = function _startIfAutoProceed() {
        var _this3 = this;

        if (this.opts.autoProceed && !this.scheduledAutoProceed) {
          this.scheduledAutoProceed = setTimeout(function () {
            _this3.scheduledAutoProceed = null;

            _this3.upload().catch(function (err) {
              if (!err.isRestriction) {
                _this3.log(err.stack || err.message || err);
              }
            });
          }, 4);
        }
      }
      /**
       * Add a new file to `state.files`. This will run `onBeforeFileAdded`,
       * try to guess file type in a clever way, check file against restrictions,
       * and start an upload if `autoProceed === true`.
       *
       * @param {object} file object to add
       * @returns {string} id for the added file
       */
      ;

      _proto.addFile = function addFile(file) {
        var _extends3;

        this._assertNewUploadAllowed(file);

        var _this$getState3 = this.getState(),
            files = _this$getState3.files;

        var newFile = this._checkAndCreateFileStateObject(files, file);

        this.setState({
          files: _extends$3({}, files, (_extends3 = {}, _extends3[newFile.id] = newFile, _extends3))
        });
        this.emit('file-added', newFile);
        this.emit('files-added', [newFile]);
        this.log("Added file: " + newFile.name + ", " + newFile.id + ", mime type: " + newFile.type);

        this._startIfAutoProceed();

        return newFile.id;
      }
      /**
       * Add multiple files to `state.files`. See the `addFile()` documentation.
       *
       * If an error occurs while adding a file, it is logged and the user is notified. This is good for UI plugins, but not for programmatic use. Programmatic users should usually still use `addFile()` on individual files.
       */
      ;

      _proto.addFiles = function addFiles(fileDescriptors) {
        var _this4 = this;

        this._assertNewUploadAllowed(); // create a copy of the files object only once


        var files = _extends$3({}, this.getState().files);

        var newFiles = [];
        var errors = [];

        for (var i = 0; i < fileDescriptors.length; i++) {
          try {
            var newFile = this._checkAndCreateFileStateObject(files, fileDescriptors[i]);

            newFiles.push(newFile);
            files[newFile.id] = newFile;
          } catch (err) {
            if (!err.isRestriction) {
              errors.push(err);
            }
          }
        }

        this.setState({
          files: files
        });
        newFiles.forEach(function (newFile) {
          _this4.emit('file-added', newFile);
        });
        this.emit('files-added', newFiles);

        if (newFiles.length > 5) {
          this.log("Added batch of " + newFiles.length + " files");
        } else {
          Object.keys(newFiles).forEach(function (fileID) {
            _this4.log("Added file: " + newFiles[fileID].name + "\n id: " + newFiles[fileID].id + "\n type: " + newFiles[fileID].type);
          });
        }

        if (newFiles.length > 0) {
          this._startIfAutoProceed();
        }

        if (errors.length > 0) {
          var message = 'Multiple errors occurred while adding files:\n';
          errors.forEach(function (subError) {
            message += "\n * " + subError.message;
          });
          this.info({
            message: this.i18n('addBulkFilesFailed', {
              smart_count: errors.length
            }),
            details: message
          }, 'error', this.opts.infoTimeout);

          if (typeof AggregateError === 'function') {
            throw new AggregateError(errors, message);
          } else {
            var err = new Error(message);
            err.errors = errors;
            throw err;
          }
        }
      };

      _proto.removeFiles = function removeFiles(fileIDs, reason) {
        var _this5 = this;

        var _this$getState4 = this.getState(),
            files = _this$getState4.files,
            currentUploads = _this$getState4.currentUploads;

        var updatedFiles = _extends$3({}, files);

        var updatedUploads = _extends$3({}, currentUploads);

        var removedFiles = Object.create(null);
        fileIDs.forEach(function (fileID) {
          if (files[fileID]) {
            removedFiles[fileID] = files[fileID];
            delete updatedFiles[fileID];
          }
        }); // Remove files from the `fileIDs` list in each upload.

        function fileIsNotRemoved(uploadFileID) {
          return removedFiles[uploadFileID] === undefined;
        }

        var uploadsToRemove = [];
        Object.keys(updatedUploads).forEach(function (uploadID) {
          var newFileIDs = currentUploads[uploadID].fileIDs.filter(fileIsNotRemoved); // Remove the upload if no files are associated with it anymore.

          if (newFileIDs.length === 0) {
            uploadsToRemove.push(uploadID);
            return;
          }

          updatedUploads[uploadID] = _extends$3({}, currentUploads[uploadID], {
            fileIDs: newFileIDs
          });
        });
        uploadsToRemove.forEach(function (uploadID) {
          delete updatedUploads[uploadID];
        });
        var stateUpdate = {
          currentUploads: updatedUploads,
          files: updatedFiles
        }; // If all files were removed - allow new uploads!

        if (Object.keys(updatedFiles).length === 0) {
          stateUpdate.allowNewUpload = true;
          stateUpdate.error = null;
        }

        this.setState(stateUpdate);

        this._calculateTotalProgress();

        var removedFileIDs = Object.keys(removedFiles);
        removedFileIDs.forEach(function (fileID) {
          _this5.emit('file-removed', removedFiles[fileID], reason);
        });

        if (removedFileIDs.length > 5) {
          this.log("Removed " + removedFileIDs.length + " files");
        } else {
          this.log("Removed files: " + removedFileIDs.join(', '));
        }
      };

      _proto.removeFile = function removeFile(fileID, reason) {
        if (reason === void 0) {
          reason = null;
        }

        this.removeFiles([fileID], reason);
      };

      _proto.pauseResume = function pauseResume(fileID) {
        if (!this.getState().capabilities.resumableUploads || this.getFile(fileID).uploadComplete) {
          return;
        }

        var wasPaused = this.getFile(fileID).isPaused || false;
        var isPaused = !wasPaused;
        this.setFileState(fileID, {
          isPaused: isPaused
        });
        this.emit('upload-pause', fileID, isPaused);
        return isPaused;
      };

      _proto.pauseAll = function pauseAll() {
        var updatedFiles = _extends$3({}, this.getState().files);

        var inProgressUpdatedFiles = Object.keys(updatedFiles).filter(function (file) {
          return !updatedFiles[file].progress.uploadComplete && updatedFiles[file].progress.uploadStarted;
        });
        inProgressUpdatedFiles.forEach(function (file) {
          var updatedFile = _extends$3({}, updatedFiles[file], {
            isPaused: true
          });

          updatedFiles[file] = updatedFile;
        });
        this.setState({
          files: updatedFiles
        });
        this.emit('pause-all');
      };

      _proto.resumeAll = function resumeAll() {
        var updatedFiles = _extends$3({}, this.getState().files);

        var inProgressUpdatedFiles = Object.keys(updatedFiles).filter(function (file) {
          return !updatedFiles[file].progress.uploadComplete && updatedFiles[file].progress.uploadStarted;
        });
        inProgressUpdatedFiles.forEach(function (file) {
          var updatedFile = _extends$3({}, updatedFiles[file], {
            isPaused: false,
            error: null
          });

          updatedFiles[file] = updatedFile;
        });
        this.setState({
          files: updatedFiles
        });
        this.emit('resume-all');
      };

      _proto.retryAll = function retryAll() {
        var updatedFiles = _extends$3({}, this.getState().files);

        var filesToRetry = Object.keys(updatedFiles).filter(function (file) {
          return updatedFiles[file].error;
        });
        filesToRetry.forEach(function (file) {
          var updatedFile = _extends$3({}, updatedFiles[file], {
            isPaused: false,
            error: null
          });

          updatedFiles[file] = updatedFile;
        });
        this.setState({
          files: updatedFiles,
          error: null
        });
        this.emit('retry-all', filesToRetry);

        if (filesToRetry.length === 0) {
          return Promise.resolve({
            successful: [],
            failed: []
          });
        }

        var uploadID = this._createUpload(filesToRetry, {
          forceAllowNewUpload: true // create new upload even if allowNewUpload: false

        });

        return this._runUpload(uploadID);
      };

      _proto.cancelAll = function cancelAll() {
        this.emit('cancel-all');

        var _this$getState5 = this.getState(),
            files = _this$getState5.files;

        var fileIDs = Object.keys(files);

        if (fileIDs.length) {
          this.removeFiles(fileIDs, 'cancel-all');
        }

        this.setState({
          totalProgress: 0,
          error: null
        });
      };

      _proto.retryUpload = function retryUpload(fileID) {
        this.setFileState(fileID, {
          error: null,
          isPaused: false
        });
        this.emit('upload-retry', fileID);

        var uploadID = this._createUpload([fileID], {
          forceAllowNewUpload: true // create new upload even if allowNewUpload: false

        });

        return this._runUpload(uploadID);
      };

      _proto.reset = function reset() {
        this.cancelAll();
      };

      _proto.logout = function logout() {
        this.iteratePlugins(function (plugin) {
          if (plugin.provider && plugin.provider.logout) {
            plugin.provider.logout();
          }
        });
      };

      _proto._calculateProgress = function _calculateProgress(file, data) {
        if (!this.getFile(file.id)) {
          this.log("Not setting progress for a file that has been removed: " + file.id);
          return;
        } // bytesTotal may be null or zero; in that case we can't divide by it


        var canHavePercentage = isFinite(data.bytesTotal) && data.bytesTotal > 0;
        this.setFileState(file.id, {
          progress: _extends$3({}, this.getFile(file.id).progress, {
            bytesUploaded: data.bytesUploaded,
            bytesTotal: data.bytesTotal,
            percentage: canHavePercentage // TODO(goto-bus-stop) flooring this should probably be the choice of the UI?
            // we get more accurate calculations if we don't round this at all.
            ? Math.round(data.bytesUploaded / data.bytesTotal * 100) : 0
          })
        });

        this._calculateTotalProgress();
      };

      _proto._calculateTotalProgress = function _calculateTotalProgress() {
        // calculate total progress, using the number of files currently uploading,
        // multiplied by 100 and the summ of individual progress of each file
        var files = this.getFiles();
        var inProgress = files.filter(function (file) {
          return file.progress.uploadStarted || file.progress.preprocess || file.progress.postprocess;
        });

        if (inProgress.length === 0) {
          this.emit('progress', 0);
          this.setState({
            totalProgress: 0
          });
          return;
        }

        var sizedFiles = inProgress.filter(function (file) {
          return file.progress.bytesTotal != null;
        });
        var unsizedFiles = inProgress.filter(function (file) {
          return file.progress.bytesTotal == null;
        });

        if (sizedFiles.length === 0) {
          var progressMax = inProgress.length * 100;
          var currentProgress = unsizedFiles.reduce(function (acc, file) {
            return acc + file.progress.percentage;
          }, 0);

          var _totalProgress = Math.round(currentProgress / progressMax * 100);

          this.setState({
            totalProgress: _totalProgress
          });
          return;
        }

        var totalSize = sizedFiles.reduce(function (acc, file) {
          return acc + file.progress.bytesTotal;
        }, 0);
        var averageSize = totalSize / sizedFiles.length;
        totalSize += averageSize * unsizedFiles.length;
        var uploadedSize = 0;
        sizedFiles.forEach(function (file) {
          uploadedSize += file.progress.bytesUploaded;
        });
        unsizedFiles.forEach(function (file) {
          uploadedSize += averageSize * (file.progress.percentage || 0) / 100;
        });
        var totalProgress = totalSize === 0 ? 0 : Math.round(uploadedSize / totalSize * 100); // hot fix, because:
        // uploadedSize ended up larger than totalSize, resulting in 1325% total

        if (totalProgress > 100) {
          totalProgress = 100;
        }

        this.setState({
          totalProgress: totalProgress
        });
        this.emit('progress', totalProgress);
      }
      /**
       * Registers listeners for all global actions, like:
       * `error`, `file-removed`, `upload-progress`
       */
      ;

      _proto._addListeners = function _addListeners() {
        var _this6 = this;

        this.on('error', function (error) {
          var errorMsg = 'Unknown error';

          if (error.message) {
            errorMsg = error.message;
          }

          if (error.details) {
            errorMsg += " " + error.details;
          }

          _this6.setState({
            error: errorMsg
          });
        });
        this.on('upload-error', function (file, error, response) {
          var errorMsg = 'Unknown error';

          if (error.message) {
            errorMsg = error.message;
          }

          if (error.details) {
            errorMsg += " " + error.details;
          }

          _this6.setFileState(file.id, {
            error: errorMsg,
            response: response
          });

          _this6.setState({
            error: error.message
          });

          if (typeof error === 'object' && error.message) {
            var newError = new Error(error.message);
            newError.details = error.message;

            if (error.details) {
              newError.details += " " + error.details;
            }

            newError.message = _this6.i18n('failedToUpload', {
              file: file.name
            });

            _this6._showOrLogErrorAndThrow(newError, {
              throwErr: false
            });
          } else {
            _this6._showOrLogErrorAndThrow(error, {
              throwErr: false
            });
          }
        });
        this.on('upload', function () {
          _this6.setState({
            error: null
          });
        });
        this.on('upload-started', function (file, upload) {
          if (!_this6.getFile(file.id)) {
            _this6.log("Not setting progress for a file that has been removed: " + file.id);

            return;
          }

          _this6.setFileState(file.id, {
            progress: {
              uploadStarted: Date.now(),
              uploadComplete: false,
              percentage: 0,
              bytesUploaded: 0,
              bytesTotal: file.size
            }
          });
        });
        this.on('upload-progress', this._calculateProgress);
        this.on('upload-success', function (file, uploadResp) {
          if (!_this6.getFile(file.id)) {
            _this6.log("Not setting progress for a file that has been removed: " + file.id);

            return;
          }

          var currentProgress = _this6.getFile(file.id).progress;

          _this6.setFileState(file.id, {
            progress: _extends$3({}, currentProgress, {
              postprocess: _this6.postProcessors.length > 0 ? {
                mode: 'indeterminate'
              } : null,
              uploadComplete: true,
              percentage: 100,
              bytesUploaded: currentProgress.bytesTotal
            }),
            response: uploadResp,
            uploadURL: uploadResp.uploadURL,
            isPaused: false
          });

          _this6._calculateTotalProgress();
        });
        this.on('preprocess-progress', function (file, progress) {
          if (!_this6.getFile(file.id)) {
            _this6.log("Not setting progress for a file that has been removed: " + file.id);

            return;
          }

          _this6.setFileState(file.id, {
            progress: _extends$3({}, _this6.getFile(file.id).progress, {
              preprocess: progress
            })
          });
        });
        this.on('preprocess-complete', function (file) {
          if (!_this6.getFile(file.id)) {
            _this6.log("Not setting progress for a file that has been removed: " + file.id);

            return;
          }

          var files = _extends$3({}, _this6.getState().files);

          files[file.id] = _extends$3({}, files[file.id], {
            progress: _extends$3({}, files[file.id].progress)
          });
          delete files[file.id].progress.preprocess;

          _this6.setState({
            files: files
          });
        });
        this.on('postprocess-progress', function (file, progress) {
          if (!_this6.getFile(file.id)) {
            _this6.log("Not setting progress for a file that has been removed: " + file.id);

            return;
          }

          _this6.setFileState(file.id, {
            progress: _extends$3({}, _this6.getState().files[file.id].progress, {
              postprocess: progress
            })
          });
        });
        this.on('postprocess-complete', function (file) {
          if (!_this6.getFile(file.id)) {
            _this6.log("Not setting progress for a file that has been removed: " + file.id);

            return;
          }

          var files = _extends$3({}, _this6.getState().files);

          files[file.id] = _extends$3({}, files[file.id], {
            progress: _extends$3({}, files[file.id].progress)
          });
          delete files[file.id].progress.postprocess; // TODO should we set some kind of `fullyComplete` property on the file object
          // so it's easier to see that the file is upload…fully complete…rather than
          // what we have to do now (`uploadComplete && !postprocess`)

          _this6.setState({
            files: files
          });
        });
        this.on('restored', function () {
          // Files may have changed--ensure progress is still accurate.
          _this6._calculateTotalProgress();
        }); // show informer if offline

        if (typeof window !== 'undefined' && window.addEventListener) {
          window.addEventListener('online', function () {
            return _this6.updateOnlineStatus();
          });
          window.addEventListener('offline', function () {
            return _this6.updateOnlineStatus();
          });
          setTimeout(function () {
            return _this6.updateOnlineStatus();
          }, 3000);
        }
      };

      _proto.updateOnlineStatus = function updateOnlineStatus() {
        var online = typeof window.navigator.onLine !== 'undefined' ? window.navigator.onLine : true;

        if (!online) {
          this.emit('is-offline');
          this.info(this.i18n('noInternetConnection'), 'error', 0);
          this.wasOffline = true;
        } else {
          this.emit('is-online');

          if (this.wasOffline) {
            this.emit('back-online');
            this.info(this.i18n('connectedToInternet'), 'success', 3000);
            this.wasOffline = false;
          }
        }
      };

      _proto.getID = function getID() {
        return this.opts.id;
      }
      /**
       * Registers a plugin with Core.
       *
       * @param {object} Plugin object
       * @param {object} [opts] object with options to be passed to Plugin
       * @returns {object} self for chaining
       */
      ;

      _proto.use = function use(Plugin, opts) {
        if (typeof Plugin !== 'function') {
          var msg = "Expected a plugin class, but got " + (Plugin === null ? 'null' : typeof Plugin) + "." + ' Please verify that the plugin was imported and spelled correctly.';
          throw new TypeError(msg);
        } // Instantiate


        var plugin = new Plugin(this, opts);
        var pluginId = plugin.id;
        this.plugins[plugin.type] = this.plugins[plugin.type] || [];

        if (!pluginId) {
          throw new Error('Your plugin must have an id');
        }

        if (!plugin.type) {
          throw new Error('Your plugin must have a type');
        }

        var existsPluginAlready = this.getPlugin(pluginId);

        if (existsPluginAlready) {
          var _msg = "Already found a plugin named '" + existsPluginAlready.id + "'. " + ("Tried to use: '" + pluginId + "'.\n") + 'Uppy plugins must have unique `id` options. See https://uppy.io/docs/plugins/#id.';

          throw new Error(_msg);
        }

        if (Plugin.VERSION) {
          this.log("Using " + pluginId + " v" + Plugin.VERSION);
        }

        this.plugins[plugin.type].push(plugin);
        plugin.install();
        return this;
      }
      /**
       * Find one Plugin by name.
       *
       * @param {string} id plugin id
       * @returns {object|boolean}
       */
      ;

      _proto.getPlugin = function getPlugin(id) {
        var foundPlugin = null;
        this.iteratePlugins(function (plugin) {
          if (plugin.id === id) {
            foundPlugin = plugin;
            return false;
          }
        });
        return foundPlugin;
      }
      /**
       * Iterate through all `use`d plugins.
       *
       * @param {Function} method that will be run on each plugin
       */
      ;

      _proto.iteratePlugins = function iteratePlugins(method) {
        var _this7 = this;

        Object.keys(this.plugins).forEach(function (pluginType) {
          _this7.plugins[pluginType].forEach(method);
        });
      }
      /**
       * Uninstall and remove a plugin.
       *
       * @param {object} instance The plugin instance to remove.
       */
      ;

      _proto.removePlugin = function removePlugin(instance) {
        var _extends4;

        this.log("Removing plugin " + instance.id);
        this.emit('plugin-remove', instance);

        if (instance.uninstall) {
          instance.uninstall();
        }

        var list = this.plugins[instance.type].slice(); // list.indexOf failed here, because Vue3 converted the plugin instance
        // to a Proxy object, which failed the strict comparison test:
        // obj !== objProxy

        var index = findIndex(list, function (item) {
          return item.id === instance.id;
        });

        if (index !== -1) {
          list.splice(index, 1);
          this.plugins[instance.type] = list;
        }

        var state = this.getState();
        var updatedState = {
          plugins: _extends$3({}, state.plugins, (_extends4 = {}, _extends4[instance.id] = undefined, _extends4))
        };
        this.setState(updatedState);
      }
      /**
       * Uninstall all plugins and close down this Uppy instance.
       */
      ;

      _proto.close = function close() {
        var _this8 = this;

        this.log("Closing Uppy instance " + this.opts.id + ": removing all files and uninstalling plugins");
        this.reset();

        this._storeUnsubscribe();

        this.iteratePlugins(function (plugin) {
          _this8.removePlugin(plugin);
        });
      }
      /**
       * Set info message in `state.info`, so that UI plugins like `Informer`
       * can display the message.
       *
       * @param {string | object} message Message to be displayed by the informer
       * @param {string} [type]
       * @param {number} [duration]
       */
      ;

      _proto.info = function info(message, type, duration) {
        if (type === void 0) {
          type = 'info';
        }

        if (duration === void 0) {
          duration = 3000;
        }

        var isComplexMessage = typeof message === 'object';
        this.setState({
          info: {
            isHidden: false,
            type: type,
            message: isComplexMessage ? message.message : message,
            details: isComplexMessage ? message.details : null
          }
        });
        this.emit('info-visible');
        clearTimeout(this.infoTimeoutID);

        if (duration === 0) {
          this.infoTimeoutID = undefined;
          return;
        } // hide the informer after `duration` milliseconds


        this.infoTimeoutID = setTimeout(this.hideInfo, duration);
      };

      _proto.hideInfo = function hideInfo() {
        var newInfo = _extends$3({}, this.getState().info, {
          isHidden: true
        });

        this.setState({
          info: newInfo
        });
        this.emit('info-hidden');
      }
      /**
       * Passes messages to a function, provided in `opts.logger`.
       * If `opts.logger: Uppy.debugLogger` or `opts.debug: true`, logs to the browser console.
       *
       * @param {string|object} message to log
       * @param {string} [type] optional `error` or `warning`
       */
      ;

      _proto.log = function log(message, type) {
        var logger = this.opts.logger;

        switch (type) {
          case 'error':
            logger.error(message);
            break;

          case 'warning':
            logger.warn(message);
            break;

          default:
            logger.debug(message);
            break;
        }
      }
      /**
       * Obsolete, event listeners are now added in the constructor.
       */
      ;

      _proto.run = function run() {
        this.log('Calling run() is no longer necessary.', 'warning');
        return this;
      }
      /**
       * Restore an upload by its ID.
       */
      ;

      _proto.restore = function restore(uploadID) {
        this.log("Core: attempting to restore upload \"" + uploadID + "\"");

        if (!this.getState().currentUploads[uploadID]) {
          this._removeUpload(uploadID);

          return Promise.reject(new Error('Nonexistent upload'));
        }

        return this._runUpload(uploadID);
      }
      /**
       * Create an upload for a bunch of files.
       *
       * @param {Array<string>} fileIDs File IDs to include in this upload.
       * @returns {string} ID of this upload.
       */
      ;

      _proto._createUpload = function _createUpload(fileIDs, opts) {
        var _extends5;

        if (opts === void 0) {
          opts = {};
        }

        var _opts = opts,
            _opts$forceAllowNewUp = _opts.forceAllowNewUpload,
            forceAllowNewUpload = _opts$forceAllowNewUp === void 0 ? false : _opts$forceAllowNewUp;

        var _this$getState6 = this.getState(),
            allowNewUpload = _this$getState6.allowNewUpload,
            currentUploads = _this$getState6.currentUploads;

        if (!allowNewUpload && !forceAllowNewUpload) {
          throw new Error('Cannot create a new upload: already uploading.');
        }

        var uploadID = cuid_1();
        this.emit('upload', {
          id: uploadID,
          fileIDs: fileIDs
        });
        this.setState({
          allowNewUpload: this.opts.allowMultipleUploads !== false,
          currentUploads: _extends$3({}, currentUploads, (_extends5 = {}, _extends5[uploadID] = {
            fileIDs: fileIDs,
            step: 0,
            result: {}
          }, _extends5))
        });
        return uploadID;
      };

      _proto._getUpload = function _getUpload(uploadID) {
        var _this$getState7 = this.getState(),
            currentUploads = _this$getState7.currentUploads;

        return currentUploads[uploadID];
      }
      /**
       * Add data to an upload's result object.
       *
       * @param {string} uploadID The ID of the upload.
       * @param {object} data Data properties to add to the result object.
       */
      ;

      _proto.addResultData = function addResultData(uploadID, data) {
        var _extends6;

        if (!this._getUpload(uploadID)) {
          this.log("Not setting result for an upload that has been removed: " + uploadID);
          return;
        }

        var currentUploads = this.getState().currentUploads;

        var currentUpload = _extends$3({}, currentUploads[uploadID], {
          result: _extends$3({}, currentUploads[uploadID].result, data)
        });

        this.setState({
          currentUploads: _extends$3({}, currentUploads, (_extends6 = {}, _extends6[uploadID] = currentUpload, _extends6))
        });
      }
      /**
       * Remove an upload, eg. if it has been canceled or completed.
       *
       * @param {string} uploadID The ID of the upload.
       */
      ;

      _proto._removeUpload = function _removeUpload(uploadID) {
        var currentUploads = _extends$3({}, this.getState().currentUploads);

        delete currentUploads[uploadID];
        this.setState({
          currentUploads: currentUploads
        });
      }
      /**
       * Run an upload. This picks up where it left off in case the upload is being restored.
       *
       * @private
       */
      ;

      _proto._runUpload = function _runUpload(uploadID) {
        var _this9 = this;

        var uploadData = this.getState().currentUploads[uploadID];
        var restoreStep = uploadData.step;
        var steps = [].concat(this.preProcessors, this.uploaders, this.postProcessors);
        var lastStep = Promise.resolve();
        steps.forEach(function (fn, step) {
          // Skip this step if we are restoring and have already completed this step before.
          if (step < restoreStep) {
            return;
          }

          lastStep = lastStep.then(function () {
            var _extends7;

            var _this9$getState = _this9.getState(),
                currentUploads = _this9$getState.currentUploads;

            var currentUpload = currentUploads[uploadID];

            if (!currentUpload) {
              return;
            }

            var updatedUpload = _extends$3({}, currentUpload, {
              step: step
            });

            _this9.setState({
              currentUploads: _extends$3({}, currentUploads, (_extends7 = {}, _extends7[uploadID] = updatedUpload, _extends7))
            }); // TODO give this the `updatedUpload` object as its only parameter maybe?
            // Otherwise when more metadata may be added to the upload this would keep getting more parameters


            return fn(updatedUpload.fileIDs, uploadID);
          }).then(function (result) {
            return null;
          });
        }); // Not returning the `catch`ed promise, because we still want to return a rejected
        // promise from this method if the upload failed.

        lastStep.catch(function (err) {
          _this9.emit('error', err, uploadID);

          _this9._removeUpload(uploadID);
        });
        return lastStep.then(function () {
          // Set result data.
          var _this9$getState2 = _this9.getState(),
              currentUploads = _this9$getState2.currentUploads;

          var currentUpload = currentUploads[uploadID];

          if (!currentUpload) {
            return;
          } // Mark postprocessing step as complete if necessary; this addresses a case where we might get
          // stuck in the postprocessing UI while the upload is fully complete.
          // If the postprocessing steps do not do any work, they may not emit postprocessing events at
          // all, and never mark the postprocessing as complete. This is fine on its own but we
          // introduced code in the @uppy/core upload-success handler to prepare postprocessing progress
          // state if any postprocessors are registered. That is to avoid a "flash of completed state"
          // before the postprocessing plugins can emit events.
          //
          // So, just in case an upload with postprocessing plugins *has* completed *without* emitting
          // postprocessing completion, we do it instead.


          currentUpload.fileIDs.forEach(function (fileID) {
            var file = _this9.getFile(fileID);

            if (file && file.progress.postprocess) {
              _this9.emit('postprocess-complete', file);
            }
          });
          var files = currentUpload.fileIDs.map(function (fileID) {
            return _this9.getFile(fileID);
          });
          var successful = files.filter(function (file) {
            return !file.error;
          });
          var failed = files.filter(function (file) {
            return file.error;
          });

          _this9.addResultData(uploadID, {
            successful: successful,
            failed: failed,
            uploadID: uploadID
          });
        }).then(function () {
          // Emit completion events.
          // This is in a separate function so that the `currentUploads` variable
          // always refers to the latest state. In the handler right above it refers
          // to an outdated object without the `.result` property.
          var _this9$getState3 = _this9.getState(),
              currentUploads = _this9$getState3.currentUploads;

          if (!currentUploads[uploadID]) {
            return;
          }

          var currentUpload = currentUploads[uploadID];
          var result = currentUpload.result;

          _this9.emit('complete', result);

          _this9._removeUpload(uploadID);

          return result;
        }).then(function (result) {
          if (result == null) {
            _this9.log("Not setting result for an upload that has been removed: " + uploadID);
          }

          return result;
        });
      }
      /**
       * Start an upload for all the files that are not currently being uploaded.
       *
       * @returns {Promise}
       */
      ;

      _proto.upload = function upload() {
        var _this10 = this;

        if (!this.plugins.uploader) {
          this.log('No uploader type plugins are used', 'warning');
        }

        var files = this.getState().files;
        var onBeforeUploadResult = this.opts.onBeforeUpload(files);

        if (onBeforeUploadResult === false) {
          return Promise.reject(new Error('Not starting the upload because onBeforeUpload returned false'));
        }

        if (onBeforeUploadResult && typeof onBeforeUploadResult === 'object') {
          files = onBeforeUploadResult; // Updating files in state, because uploader plugins receive file IDs,
          // and then fetch the actual file object from state

          this.setState({
            files: files
          });
        }

        return Promise.resolve().then(function () {
          return _this10._checkMinNumberOfFiles(files);
        }).catch(function (err) {
          _this10._showOrLogErrorAndThrow(err);
        }).then(function () {
          var _this10$getState = _this10.getState(),
              currentUploads = _this10$getState.currentUploads; // get a list of files that are currently assigned to uploads


          var currentlyUploadingFiles = Object.keys(currentUploads).reduce(function (prev, curr) {
            return prev.concat(currentUploads[curr].fileIDs);
          }, []);
          var waitingFileIDs = [];
          Object.keys(files).forEach(function (fileID) {
            var file = _this10.getFile(fileID); // if the file hasn't started uploading and hasn't already been assigned to an upload..


            if (!file.progress.uploadStarted && currentlyUploadingFiles.indexOf(fileID) === -1) {
              waitingFileIDs.push(file.id);
            }
          });

          var uploadID = _this10._createUpload(waitingFileIDs);

          return _this10._runUpload(uploadID);
        }).catch(function (err) {
          _this10._showOrLogErrorAndThrow(err, {
            showInformer: false
          });
        });
      };

      _createClass(Uppy, [{
        key: "state",
        get: function get() {
          return this.getState();
        }
      }]);

      return Uppy;
    }();

    Uppy.VERSION = "1.18.1";

    var lib$1 = function (opts) {
      return new Uppy(opts);
    }; // Expose class constructor.


    var Uppy_1 = Uppy;
    var Plugin_1 = Plugin;
    var debugLogger_1 = debugLogger$1;
    lib$1.Uppy = Uppy_1;
    lib$1.Plugin = Plugin_1;
    lib$1.debugLogger = debugLogger_1;

    var classnames = createCommonjsModule(function (module) {
    /*!
      Copyright (c) 2018 Jed Watson.
      Licensed under the MIT License (MIT), see
      http://jedwatson.github.io/classnames
    */
    /* global define */

    (function () {

    	var hasOwn = {}.hasOwnProperty;

    	function classNames() {
    		var classes = [];

    		for (var i = 0; i < arguments.length; i++) {
    			var arg = arguments[i];
    			if (!arg) continue;

    			var argType = typeof arg;

    			if (argType === 'string' || argType === 'number') {
    				classes.push(arg);
    			} else if (Array.isArray(arg)) {
    				if (arg.length) {
    					var inner = classNames.apply(null, arg);
    					if (inner) {
    						classes.push(inner);
    					}
    				}
    			} else if (argType === 'object') {
    				if (arg.toString === Object.prototype.toString) {
    					for (var key in arg) {
    						if (hasOwn.call(arg, key) && arg[key]) {
    							classes.push(key);
    						}
    					}
    				} else {
    					classes.push(arg.toString());
    				}
    			}
    		}

    		return classes.join(' ');
    	}

    	if ( module.exports) {
    		classNames.default = classNames;
    		module.exports = classNames;
    	} else {
    		window.classNames = classNames;
    	}
    }());
    });

    var isShallowEqual = function isShallowEqual (a, b) {
      if (a === b) return true
      for (var i in a) if (!(i in b)) return false
      for (var i in b) if (a[i] !== b[i]) return false
      return true
    };

    var h$1 = _require2.h;

    function iconImage() {
      return h$1("svg", {
        "aria-hidden": "true",
        focusable: "false",
        width: "25",
        height: "25",
        viewBox: "0 0 25 25"
      }, h$1("g", {
        fill: "#686DE0",
        fillRule: "evenodd"
      }, h$1("path", {
        d: "M5 7v10h15V7H5zm0-1h15a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z",
        fillRule: "nonzero"
      }), h$1("path", {
        d: "M6.35 17.172l4.994-5.026a.5.5 0 0 1 .707 0l2.16 2.16 3.505-3.505a.5.5 0 0 1 .707 0l2.336 2.31-.707.72-1.983-1.97-3.505 3.505a.5.5 0 0 1-.707 0l-2.16-2.159-3.938 3.939-1.409.026z",
        fillRule: "nonzero"
      }), h$1("circle", {
        cx: "7.5",
        cy: "9.5",
        r: "1.5"
      })));
    }

    function iconAudio() {
      return h$1("svg", {
        "aria-hidden": "true",
        focusable: "false",
        className: "uppy-c-icon",
        width: "25",
        height: "25",
        viewBox: "0 0 25 25"
      }, h$1("path", {
        d: "M9.5 18.64c0 1.14-1.145 2-2.5 2s-2.5-.86-2.5-2c0-1.14 1.145-2 2.5-2 .557 0 1.079.145 1.5.396V7.25a.5.5 0 0 1 .379-.485l9-2.25A.5.5 0 0 1 18.5 5v11.64c0 1.14-1.145 2-2.5 2s-2.5-.86-2.5-2c0-1.14 1.145-2 2.5-2 .557 0 1.079.145 1.5.396V8.67l-8 2v7.97zm8-11v-2l-8 2v2l8-2zM7 19.64c.855 0 1.5-.484 1.5-1s-.645-1-1.5-1-1.5.484-1.5 1 .645 1 1.5 1zm9-2c.855 0 1.5-.484 1.5-1s-.645-1-1.5-1-1.5.484-1.5 1 .645 1 1.5 1z",
        fill: "#049BCF",
        fillRule: "nonzero"
      }));
    }

    function iconVideo() {
      return h$1("svg", {
        "aria-hidden": "true",
        focusable: "false",
        className: "uppy-c-icon",
        width: "25",
        height: "25",
        viewBox: "0 0 25 25"
      }, h$1("path", {
        d: "M16 11.834l4.486-2.691A1 1 0 0 1 22 10v6a1 1 0 0 1-1.514.857L16 14.167V17a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v2.834zM15 9H5v8h10V9zm1 4l5 3v-6l-5 3z",
        fill: "#19AF67",
        fillRule: "nonzero"
      }));
    }

    function iconPDF() {
      return h$1("svg", {
        "aria-hidden": "true",
        focusable: "false",
        className: "uppy-c-icon",
        width: "25",
        height: "25",
        viewBox: "0 0 25 25"
      }, h$1("path", {
        d: "M9.766 8.295c-.691-1.843-.539-3.401.747-3.726 1.643-.414 2.505.938 2.39 3.299-.039.79-.194 1.662-.537 3.148.324.49.66.967 1.055 1.51.17.231.382.488.629.757 1.866-.128 3.653.114 4.918.655 1.487.635 2.192 1.685 1.614 2.84-.566 1.133-1.839 1.084-3.416.249-1.141-.604-2.457-1.634-3.51-2.707a13.467 13.467 0 0 0-2.238.426c-1.392 4.051-4.534 6.453-5.707 4.572-.986-1.58 1.38-4.206 4.914-5.375.097-.322.185-.656.264-1.001.08-.353.306-1.31.407-1.737-.678-1.059-1.2-2.031-1.53-2.91zm2.098 4.87c-.033.144-.068.287-.104.427l.033-.01-.012.038a14.065 14.065 0 0 1 1.02-.197l-.032-.033.052-.004a7.902 7.902 0 0 1-.208-.271c-.197-.27-.38-.526-.555-.775l-.006.028-.002-.003c-.076.323-.148.632-.186.8zm5.77 2.978c1.143.605 1.832.632 2.054.187.26-.519-.087-1.034-1.113-1.473-.911-.39-2.175-.608-3.55-.608.845.766 1.787 1.459 2.609 1.894zM6.559 18.789c.14.223.693.16 1.425-.413.827-.648 1.61-1.747 2.208-3.206-2.563 1.064-4.102 2.867-3.633 3.62zm5.345-10.97c.088-1.793-.351-2.48-1.146-2.28-.473.119-.564 1.05-.056 2.405.213.566.52 1.188.908 1.859.18-.858.268-1.453.294-1.984z",
        fill: "#E2514A",
        fillRule: "nonzero"
      }));
    }

    function iconArchive() {
      return h$1("svg", {
        "aria-hidden": "true",
        focusable: "false",
        width: "25",
        height: "25",
        viewBox: "0 0 25 25"
      }, h$1("path", {
        d: "M10.45 2.05h1.05a.5.5 0 0 1 .5.5v.024a.5.5 0 0 1-.5.5h-1.05a.5.5 0 0 1-.5-.5V2.55a.5.5 0 0 1 .5-.5zm2.05 1.024h1.05a.5.5 0 0 1 .5.5V3.6a.5.5 0 0 1-.5.5H12.5a.5.5 0 0 1-.5-.5v-.025a.5.5 0 0 1 .5-.5v-.001zM10.45 0h1.05a.5.5 0 0 1 .5.5v.025a.5.5 0 0 1-.5.5h-1.05a.5.5 0 0 1-.5-.5V.5a.5.5 0 0 1 .5-.5zm2.05 1.025h1.05a.5.5 0 0 1 .5.5v.024a.5.5 0 0 1-.5.5H12.5a.5.5 0 0 1-.5-.5v-.024a.5.5 0 0 1 .5-.5zm-2.05 3.074h1.05a.5.5 0 0 1 .5.5v.025a.5.5 0 0 1-.5.5h-1.05a.5.5 0 0 1-.5-.5v-.025a.5.5 0 0 1 .5-.5zm2.05 1.025h1.05a.5.5 0 0 1 .5.5v.024a.5.5 0 0 1-.5.5H12.5a.5.5 0 0 1-.5-.5v-.024a.5.5 0 0 1 .5-.5zm-2.05 1.024h1.05a.5.5 0 0 1 .5.5v.025a.5.5 0 0 1-.5.5h-1.05a.5.5 0 0 1-.5-.5v-.025a.5.5 0 0 1 .5-.5zm2.05 1.025h1.05a.5.5 0 0 1 .5.5v.025a.5.5 0 0 1-.5.5H12.5a.5.5 0 0 1-.5-.5v-.025a.5.5 0 0 1 .5-.5zm-2.05 1.025h1.05a.5.5 0 0 1 .5.5v.025a.5.5 0 0 1-.5.5h-1.05a.5.5 0 0 1-.5-.5v-.025a.5.5 0 0 1 .5-.5zm2.05 1.025h1.05a.5.5 0 0 1 .5.5v.024a.5.5 0 0 1-.5.5H12.5a.5.5 0 0 1-.5-.5v-.024a.5.5 0 0 1 .5-.5zm-1.656 3.074l-.82 5.946c.52.302 1.174.458 1.976.458.803 0 1.455-.156 1.975-.458l-.82-5.946h-2.311zm0-1.025h2.312c.512 0 .946.378 1.015.885l.82 5.946c.056.412-.142.817-.501 1.026-.686.398-1.515.597-2.49.597-.974 0-1.804-.199-2.49-.597a1.025 1.025 0 0 1-.5-1.026l.819-5.946c.07-.507.503-.885 1.015-.885zm.545 6.6a.5.5 0 0 1-.397-.561l.143-.999a.5.5 0 0 1 .495-.429h.74a.5.5 0 0 1 .495.43l.143.998a.5.5 0 0 1-.397.561c-.404.08-.819.08-1.222 0z",
        fill: "#00C469",
        fillRule: "nonzero"
      }));
    }

    function iconFile() {
      return h$1("svg", {
        "aria-hidden": "true",
        focusable: "false",
        className: "uppy-c-icon",
        width: "25",
        height: "25",
        viewBox: "0 0 25 25"
      }, h$1("g", {
        fill: "#A7AFB7",
        fillRule: "nonzero"
      }, h$1("path", {
        d: "M5.5 22a.5.5 0 0 1-.5-.5v-18a.5.5 0 0 1 .5-.5h10.719a.5.5 0 0 1 .367.16l3.281 3.556a.5.5 0 0 1 .133.339V21.5a.5.5 0 0 1-.5.5h-14zm.5-1h13V7.25L16 4H6v17z"
      }), h$1("path", {
        d: "M15 4v3a1 1 0 0 0 1 1h3V7h-3V4h-1z"
      })));
    }

    function iconText() {
      return h$1("svg", {
        "aria-hidden": "true",
        focusable: "false",
        className: "uppy-c-icon",
        width: "25",
        height: "25",
        viewBox: "0 0 25 25"
      }, h$1("path", {
        d: "M4.5 7h13a.5.5 0 1 1 0 1h-13a.5.5 0 0 1 0-1zm0 3h15a.5.5 0 1 1 0 1h-15a.5.5 0 1 1 0-1zm0 3h15a.5.5 0 1 1 0 1h-15a.5.5 0 1 1 0-1zm0 3h10a.5.5 0 1 1 0 1h-10a.5.5 0 1 1 0-1z",
        fill: "#5A5E69",
        fillRule: "nonzero"
      }));
    }

    var getFileTypeIcon = function getIconByMime(fileType) {
      var defaultChoice = {
        color: '#838999',
        icon: iconFile()
      };
      if (!fileType) return defaultChoice;
      var fileTypeGeneral = fileType.split('/')[0];
      var fileTypeSpecific = fileType.split('/')[1]; // Text

      if (fileTypeGeneral === 'text') {
        return {
          color: '#5a5e69',
          icon: iconText()
        };
      } // Image


      if (fileTypeGeneral === 'image') {
        return {
          color: '#686de0',
          icon: iconImage()
        };
      } // Audio


      if (fileTypeGeneral === 'audio') {
        return {
          color: '#068dbb',
          icon: iconAudio()
        };
      } // Video


      if (fileTypeGeneral === 'video') {
        return {
          color: '#19af67',
          icon: iconVideo()
        };
      } // PDF


      if (fileTypeGeneral === 'application' && fileTypeSpecific === 'pdf') {
        return {
          color: '#e25149',
          icon: iconPDF()
        };
      } // Archive


      var archiveTypes = ['zip', 'x-7z-compressed', 'x-rar-compressed', 'x-tar', 'x-gzip', 'x-apple-diskimage'];

      if (fileTypeGeneral === 'application' && archiveTypes.indexOf(fileTypeSpecific) !== -1) {
        return {
          color: '#00C469',
          icon: iconArchive()
        };
      }

      return defaultChoice;
    };

    var h$2 = _require2.h;

    var FilePreview = function FilePreview(props) {
      var file = props.file;

      if (file.preview) {
        return h$2("img", {
          className: "uppy-Dashboard-Item-previewImg",
          alt: file.name,
          src: file.preview
        });
      }

      var _getFileTypeIcon = getFileTypeIcon(file.type),
          color = _getFileTypeIcon.color,
          icon = _getFileTypeIcon.icon;

      return h$2("div", {
        className: "uppy-Dashboard-Item-previewIconWrap"
      }, h$2("span", {
        className: "uppy-Dashboard-Item-previewIcon",
        style: {
          color: color
        }
      }, icon), h$2("svg", {
        "aria-hidden": "true",
        focusable: "false",
        className: "uppy-Dashboard-Item-previewIconBg",
        width: "58",
        height: "76",
        viewBox: "0 0 58 76"
      }, h$2("rect", {
        fill: "#FFF",
        width: "58",
        height: "76",
        rx: "3",
        fillRule: "evenodd"
      })));
    };

    var h$3 = _require2.h;





    var FilePreviewAndLink = function FilePreviewAndLink(props) {
      return h$3("div", {
        className: "uppy-Dashboard-Item-previewInnerWrap",
        style: {
          backgroundColor: getFileTypeIcon(props.file.type).color
        }
      }, props.showLinkToFileUploadResult && props.file.uploadURL && h$3("a", {
        className: "uppy-Dashboard-Item-previewLink",
        href: props.file.uploadURL,
        rel: "noreferrer noopener",
        target: "_blank",
        "aria-label": props.file.meta.name
      }), h$3(FilePreview, {
        file: props.file
      }));
    };

    var h$4 = _require2.h;

    function onPauseResumeCancelRetry(props) {
      if (props.isUploaded) return;

      if (props.error && !props.hideRetryButton) {
        props.retryUpload(props.file.id);
        return;
      }

      if (props.resumableUploads && !props.hidePauseResumeButton) {
        props.pauseUpload(props.file.id);
      } else if (props.individualCancellation && !props.hideCancelButton) {
        props.cancelUpload(props.file.id);
      }
    }

    function progressIndicatorTitle(props) {
      if (props.isUploaded) {
        return props.i18n('uploadComplete');
      }

      if (props.error) {
        return props.i18n('retryUpload');
      }

      if (props.resumableUploads) {
        if (props.file.isPaused) {
          return props.i18n('resumeUpload');
        }

        return props.i18n('pauseUpload');
      }

      if (props.individualCancellation) {
        return props.i18n('cancelUpload');
      }

      return '';
    }

    function ProgressIndicatorButton(props) {
      return h$4("div", {
        className: "uppy-Dashboard-Item-progress"
      }, h$4("button", {
        className: "uppy-u-reset uppy-Dashboard-Item-progressIndicator",
        type: "button",
        "aria-label": progressIndicatorTitle(props),
        title: progressIndicatorTitle(props),
        onClick: function onClick() {
          return onPauseResumeCancelRetry(props);
        }
      }, props.children));
    }

    function ProgressCircleContainer(_ref) {
      var children = _ref.children;
      return h$4("svg", {
        "aria-hidden": "true",
        focusable: "false",
        width: "70",
        height: "70",
        viewBox: "0 0 36 36",
        className: "uppy-c-icon uppy-Dashboard-Item-progressIcon--circle"
      }, children);
    }

    function ProgressCircle(_ref2) {
      var progress = _ref2.progress;
      // circle length equals 2 * PI * R
      var circleLength = 2 * Math.PI * 15;
      return h$4("g", null, h$4("circle", {
        className: "uppy-Dashboard-Item-progressIcon--bg",
        r: "15",
        cx: "18",
        cy: "18",
        "stroke-width": "2",
        fill: "none"
      }), h$4("circle", {
        className: "uppy-Dashboard-Item-progressIcon--progress",
        r: "15",
        cx: "18",
        cy: "18",
        transform: "rotate(-90, 18, 18)",
        fill: "none",
        "stroke-width": "2",
        "stroke-dasharray": circleLength,
        "stroke-dashoffset": circleLength - circleLength / 100 * progress
      }));
    }

    var FileProgress = function FileProgress(props) {
      // Nothing if upload has not started
      if (!props.file.progress.uploadStarted) {
        return null;
      } // Green checkmark when complete


      if (props.isUploaded) {
        return h$4("div", {
          className: "uppy-Dashboard-Item-progress"
        }, h$4("div", {
          className: "uppy-Dashboard-Item-progressIndicator"
        }, h$4(ProgressCircleContainer, null, h$4("circle", {
          r: "15",
          cx: "18",
          cy: "18",
          fill: "#1bb240"
        }), h$4("polygon", {
          className: "uppy-Dashboard-Item-progressIcon--check",
          transform: "translate(2, 3)",
          points: "14 22.5 7 15.2457065 8.99985857 13.1732815 14 18.3547104 22.9729883 9 25 11.1005634"
        }))));
      } // Retry button for error


      if (props.error && !props.hideRetryButton) {
        return h$4(ProgressIndicatorButton, props, h$4("svg", {
          "aria-hidden": "true",
          focusable: "false",
          className: "uppy-c-icon uppy-Dashboard-Item-progressIcon--retry",
          width: "28",
          height: "31",
          viewBox: "0 0 16 19"
        }, h$4("path", {
          d: "M16 11a8 8 0 1 1-8-8v2a6 6 0 1 0 6 6h2z"
        }), h$4("path", {
          d: "M7.9 3H10v2H7.9z"
        }), h$4("path", {
          d: "M8.536.5l3.535 3.536-1.414 1.414L7.12 1.914z"
        }), h$4("path", {
          d: "M10.657 2.621l1.414 1.415L8.536 7.57 7.12 6.157z"
        })));
      } // Pause/resume button for resumable uploads


      if (props.resumableUploads && !props.hidePauseResumeButton) {
        return h$4(ProgressIndicatorButton, props, h$4(ProgressCircleContainer, null, h$4(ProgressCircle, {
          progress: props.file.progress.percentage
        }), props.file.isPaused ? h$4("polygon", {
          className: "uppy-Dashboard-Item-progressIcon--play",
          transform: "translate(3, 3)",
          points: "12 20 12 10 20 15"
        }) : h$4("g", {
          className: "uppy-Dashboard-Item-progressIcon--pause",
          transform: "translate(14.5, 13)"
        }, h$4("rect", {
          x: "0",
          y: "0",
          width: "2",
          height: "10",
          rx: "0"
        }), h$4("rect", {
          x: "5",
          y: "0",
          width: "2",
          height: "10",
          rx: "0"
        }))));
      } // Cancel button for non-resumable uploads if individualCancellation is supported (not bundled)


      if (!props.resumableUploads && props.individualCancellation && !props.hideCancelButton) {
        return h$4(ProgressIndicatorButton, props, h$4(ProgressCircleContainer, null, h$4(ProgressCircle, {
          progress: props.file.progress.percentage
        }), h$4("polygon", {
          className: "cancel",
          transform: "translate(2, 2)",
          points: "19.8856516 11.0625 16 14.9481516 12.1019737 11.0625 11.0625 12.1143484 14.9481516 16 11.0625 19.8980263 12.1019737 20.9375 16 17.0518484 19.8856516 20.9375 20.9375 19.8980263 17.0518484 16 20.9375 12"
        })));
      } // Just progress when buttons are disabled


      return h$4("div", {
        className: "uppy-Dashboard-Item-progress"
      }, h$4("div", {
        className: "uppy-Dashboard-Item-progressIndicator"
      }, h$4(ProgressCircleContainer, null, h$4(ProgressCircle, {
        progress: props.file.progress.percentage
      }))));
    };

    /**
     * Truncates a string to the given number of chars (maxLength) by inserting '...' in the middle of that string.
     * Partially taken from https://stackoverflow.com/a/5723274/3192470.
     *
     * @param {string} string - string to be truncated
     * @param {number} maxLength - maximum size of the resulting string
     * @returns {string}
     */
    var truncateString = function truncateString(string, maxLength) {
      var separator = '...'; // Return original string if it's already shorter than maxLength

      if (string.length <= maxLength) {
        return string; // Return truncated substring without '...' if string can't be meaningfully truncated
      }

      if (maxLength <= separator.length) {
        return string.substr(0, maxLength); // Return truncated string divided in half by '...'
      }

      var charsToShow = maxLength - separator.length;
      var frontChars = Math.ceil(charsToShow / 2);
      var backChars = Math.floor(charsToShow / 2);
      return string.substr(0, frontChars) + separator + string.substr(string.length - backChars);
    };

    var h$5 = _require2.h;





    var renderAcquirerIcon = function renderAcquirerIcon(acquirer, props) {
      return h$5("span", {
        title: props.i18n('fileSource', {
          name: acquirer.name
        })
      }, acquirer.icon());
    };

    var renderFileSource = function renderFileSource(props) {
      return props.file.source && props.file.source !== props.id && h$5("div", {
        className: "uppy-Dashboard-Item-sourceIcon"
      }, props.acquirers.map(function (acquirer) {
        if (acquirer.id === props.file.source) {
          return renderAcquirerIcon(acquirer, props);
        }
      }));
    };

    var renderFileName = function renderFileName(props) {
      // Take up at most 2 lines on any screen
      var maxNameLength; // For very small mobile screens

      if (props.containerWidth <= 352) {
        maxNameLength = 35; // For regular mobile screens
      } else if (props.containerWidth <= 576) {
        maxNameLength = 60; // For desktops
      } else {
        maxNameLength = 30;
      }

      return h$5("div", {
        className: "uppy-Dashboard-Item-name",
        title: props.file.meta.name
      }, truncateString(props.file.meta.name, maxNameLength));
    };

    var renderFileSize = function renderFileSize(props) {
      return props.file.data.size && h$5("div", {
        className: "uppy-Dashboard-Item-statusSize"
      }, prettierBytes(props.file.data.size));
    };

    var ErrorButton = function ErrorButton(_ref) {
      var file = _ref.file,
          onClick = _ref.onClick;

      if (file.error) {
        return h$5("span", {
          className: "uppy-Dashboard-Item-errorDetails",
          "aria-label": file.error,
          "data-microtip-position": "bottom",
          "data-microtip-size": "medium",
          role: "tooltip",
          onClick: onClick
        }, "?");
      }

      return null;
    };

    var FileInfo = function FileInfo(props) {
      return h$5("div", {
        className: "uppy-Dashboard-Item-fileInfo",
        "data-uppy-file-source": props.file.source
      }, renderFileName(props), h$5("div", {
        className: "uppy-Dashboard-Item-status"
      }, renderFileSize(props), renderFileSource(props), h$5(ErrorButton, {
        file: props.file,
        onClick: function onClick() {
          alert(props.file.error);
        }
      })));
    };

    /**
     * Copies text to clipboard by creating an almost invisible textarea,
     * adding text there, then running execCommand('copy').
     * Falls back to prompt() when the easy way fails (hello, Safari!)
     * From http://stackoverflow.com/a/30810322
     *
     * @param {string} textToCopy
     * @param {string} fallbackString
     * @returns {Promise}
     */
    var copyToClipboard = function copyToClipboard(textToCopy, fallbackString) {
      fallbackString = fallbackString || 'Copy the URL below';
      return new Promise(function (resolve) {
        var textArea = document.createElement('textarea');
        textArea.setAttribute('style', {
          position: 'fixed',
          top: 0,
          left: 0,
          width: '2em',
          height: '2em',
          padding: 0,
          border: 'none',
          outline: 'none',
          boxShadow: 'none',
          background: 'transparent'
        });
        textArea.value = textToCopy;
        document.body.appendChild(textArea);
        textArea.select();

        var magicCopyFailed = function magicCopyFailed() {
          document.body.removeChild(textArea);
          window.prompt(fallbackString, textToCopy);
          resolve();
        };

        try {
          var successful = document.execCommand('copy');

          if (!successful) {
            return magicCopyFailed('copy command unavailable');
          }

          document.body.removeChild(textArea);
          return resolve();
        } catch (err) {
          document.body.removeChild(textArea);
          return magicCopyFailed();
        }
      });
    };

    var h$6 = _require2.h;



    function EditButton(_ref) {
      var file = _ref.file,
          uploadInProgressOrComplete = _ref.uploadInProgressOrComplete,
          metaFields = _ref.metaFields,
          canEditFile = _ref.canEditFile,
          i18n = _ref.i18n,
          _onClick = _ref.onClick;

      if (!uploadInProgressOrComplete && metaFields && metaFields.length > 0 || !uploadInProgressOrComplete && canEditFile(file)) {
        return h$6("button", {
          className: "uppy-u-reset uppy-Dashboard-Item-action uppy-Dashboard-Item-action--edit",
          type: "button",
          "aria-label": i18n('editFile') + " " + file.meta.name,
          title: i18n('editFile'),
          onClick: function onClick() {
            return _onClick();
          }
        }, h$6("svg", {
          "aria-hidden": "true",
          focusable: "false",
          className: "uppy-c-icon",
          width: "14",
          height: "14",
          viewBox: "0 0 14 14"
        }, h$6("g", {
          fillRule: "evenodd"
        }, h$6("path", {
          d: "M1.5 10.793h2.793A1 1 0 0 0 5 10.5L11.5 4a1 1 0 0 0 0-1.414L9.707.793a1 1 0 0 0-1.414 0l-6.5 6.5A1 1 0 0 0 1.5 8v2.793zm1-1V8L9 1.5l1.793 1.793-6.5 6.5H2.5z",
          fillRule: "nonzero"
        }), h$6("rect", {
          x: "1",
          y: "12.293",
          width: "11",
          height: "1",
          rx: ".5"
        }), h$6("path", {
          fillRule: "nonzero",
          d: "M6.793 2.5L9.5 5.207l.707-.707L7.5 1.793z"
        }))));
      }

      return null;
    }

    function RemoveButton(_ref2) {
      var i18n = _ref2.i18n,
          _onClick2 = _ref2.onClick;
      return h$6("button", {
        className: "uppy-u-reset uppy-Dashboard-Item-action uppy-Dashboard-Item-action--remove",
        type: "button",
        "aria-label": i18n('removeFile'),
        title: i18n('removeFile'),
        onClick: function onClick() {
          return _onClick2();
        }
      }, h$6("svg", {
        "aria-hidden": "true",
        focusable: "false",
        className: "uppy-c-icon",
        width: "18",
        height: "18",
        viewBox: "0 0 18 18"
      }, h$6("path", {
        d: "M9 0C4.034 0 0 4.034 0 9s4.034 9 9 9 9-4.034 9-9-4.034-9-9-9z"
      }), h$6("path", {
        fill: "#FFF",
        d: "M13 12.222l-.778.778L9 9.778 5.778 13 5 12.222 8.222 9 5 5.778 5.778 5 9 8.222 12.222 5l.778.778L9.778 9z"
      })));
    }

    var copyLinkToClipboard = function copyLinkToClipboard(event, props) {
      copyToClipboard(props.file.uploadURL, props.i18n('copyLinkToClipboardFallback')).then(function () {
        props.log('Link copied to clipboard.');
        props.info(props.i18n('copyLinkToClipboardSuccess'), 'info', 3000);
      }).catch(props.log) // avoid losing focus
      .then(function () {
        return event.target.focus({
          preventScroll: true
        });
      });
    };

    function CopyLinkButton(props) {
      return h$6("button", {
        className: "uppy-u-reset uppy-Dashboard-Item-action uppy-Dashboard-Item-action--copyLink",
        type: "button",
        "aria-label": props.i18n('copyLink'),
        title: props.i18n('copyLink'),
        onClick: function onClick(event) {
          return copyLinkToClipboard(event, props);
        }
      }, h$6("svg", {
        "aria-hidden": "true",
        focusable: "false",
        className: "uppy-c-icon",
        width: "14",
        height: "14",
        viewBox: "0 0 14 12"
      }, h$6("path", {
        d: "M7.94 7.703a2.613 2.613 0 0 1-.626 2.681l-.852.851a2.597 2.597 0 0 1-1.849.766A2.616 2.616 0 0 1 2.764 7.54l.852-.852a2.596 2.596 0 0 1 2.69-.625L5.267 7.099a1.44 1.44 0 0 0-.833.407l-.852.851a1.458 1.458 0 0 0 1.03 2.486c.39 0 .755-.152 1.03-.426l.852-.852c.231-.231.363-.522.406-.824l1.04-1.038zm4.295-5.937A2.596 2.596 0 0 0 10.387 1c-.698 0-1.355.272-1.849.766l-.852.851a2.614 2.614 0 0 0-.624 2.688l1.036-1.036c.041-.304.173-.6.407-.833l.852-.852c.275-.275.64-.426 1.03-.426a1.458 1.458 0 0 1 1.03 2.486l-.852.851a1.442 1.442 0 0 1-.824.406l-1.04 1.04a2.596 2.596 0 0 0 2.683-.628l.851-.85a2.616 2.616 0 0 0 0-3.697zm-6.88 6.883a.577.577 0 0 0 .82 0l3.474-3.474a.579.579 0 1 0-.819-.82L5.355 7.83a.579.579 0 0 0 0 .819z"
      })));
    }

    var Buttons = function Buttons(props) {
      var file = props.file,
          uploadInProgressOrComplete = props.uploadInProgressOrComplete,
          canEditFile = props.canEditFile,
          metaFields = props.metaFields,
          showLinkToFileUploadResult = props.showLinkToFileUploadResult,
          showRemoveButton = props.showRemoveButton,
          i18n = props.i18n,
          removeFile = props.removeFile,
          toggleFileCard = props.toggleFileCard,
          openFileEditor = props.openFileEditor,
          log = props.log,
          info = props.info;

      var editAction = function editAction() {
        if (metaFields && metaFields.length > 0) {
          toggleFileCard(true, file.id);
        } else {
          openFileEditor(file);
        }
      };

      return h$6("div", {
        className: "uppy-Dashboard-Item-actionWrapper"
      }, h$6(EditButton, {
        i18n: i18n,
        file: file,
        uploadInProgressOrComplete: uploadInProgressOrComplete,
        canEditFile: canEditFile,
        metaFields: metaFields,
        onClick: editAction
      }), showLinkToFileUploadResult && file.uploadURL ? h$6(CopyLinkButton, {
        file: file,
        i18n: i18n,
        info: info,
        log: log
      }) : null, showRemoveButton ? h$6(RemoveButton, {
        i18n: i18n,
        info: props.info,
        log: props.log,
        onClick: function onClick() {
          return removeFile(file.id, 'removed-by-user');
        }
      }) : null);
    };

    function _inheritsLoose$1(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; _setPrototypeOf$1(subClass, superClass); }

    function _setPrototypeOf$1(o, p) { _setPrototypeOf$1 = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$1(o, p); }

    var h$7 = _require2.h,
        Component$1 = _require2.Component;













    var FileItem = /*#__PURE__*/function (_Component) {
      _inheritsLoose$1(FileItem, _Component);

      function FileItem() {
        return _Component.apply(this, arguments) || this;
      }

      var _proto = FileItem.prototype;

      _proto.shouldComponentUpdate = function shouldComponentUpdate(nextProps) {
        return !isShallowEqual(this.props, nextProps);
      };

      _proto.componentDidMount = function componentDidMount() {
        var file = this.props.file;

        if (!file.preview) {
          this.props.handleRequestThumbnail(file);
        }
      };

      _proto.componentWillUnmount = function componentWillUnmount() {
        var file = this.props.file;

        if (!file.preview) {
          this.props.handleCancelThumbnail(file);
        }
      };

      _proto.render = function render() {
        var file = this.props.file;
        var isProcessing = file.progress.preprocess || file.progress.postprocess;
        var isUploaded = file.progress.uploadComplete && !isProcessing && !file.error;
        var uploadInProgressOrComplete = file.progress.uploadStarted || isProcessing;
        var uploadInProgress = file.progress.uploadStarted && !file.progress.uploadComplete || isProcessing;
        var error = file.error || false;
        var showRemoveButton = this.props.individualCancellation ? !isUploaded : !uploadInProgress && !isUploaded;

        if (isUploaded && this.props.showRemoveButtonAfterComplete) {
          showRemoveButton = true;
        }

        var dashboardItemClass = classnames({
          'uppy-Dashboard-Item': true,
          'is-inprogress': uploadInProgress,
          'is-processing': isProcessing,
          'is-complete': isUploaded,
          'is-error': !!error,
          'is-resumable': this.props.resumableUploads,
          'is-noIndividualCancellation': !this.props.individualCancellation
        });
        return h$7("div", {
          className: dashboardItemClass,
          id: "uppy_" + file.id,
          role: this.props.role
        }, h$7("div", {
          className: "uppy-Dashboard-Item-preview"
        }, h$7(FilePreviewAndLink, {
          file: file,
          showLinkToFileUploadResult: this.props.showLinkToFileUploadResult
        }), h$7(FileProgress, {
          file: file,
          error: error,
          isUploaded: isUploaded,
          hideRetryButton: this.props.hideRetryButton,
          hideCancelButton: this.props.hideCancelButton,
          hidePauseResumeButton: this.props.hidePauseResumeButton,
          showRemoveButtonAfterComplete: this.props.showRemoveButtonAfterComplete,
          resumableUploads: this.props.resumableUploads,
          individualCancellation: this.props.individualCancellation,
          pauseUpload: this.props.pauseUpload,
          cancelUpload: this.props.cancelUpload,
          retryUpload: this.props.retryUpload,
          i18n: this.props.i18n
        })), h$7("div", {
          className: "uppy-Dashboard-Item-fileInfoAndButtons"
        }, h$7(FileInfo, {
          file: file,
          id: this.props.id,
          acquirers: this.props.acquirers,
          containerWidth: this.props.containerWidth,
          i18n: this.props.i18n
        }), h$7(Buttons, {
          file: file,
          metaFields: this.props.metaFields,
          showLinkToFileUploadResult: this.props.showLinkToFileUploadResult,
          showRemoveButton: showRemoveButton,
          canEditFile: this.props.canEditFile,
          uploadInProgressOrComplete: uploadInProgressOrComplete,
          removeFile: this.props.removeFile,
          toggleFileCard: this.props.toggleFileCard,
          openFileEditor: this.props.openFileEditor,
          i18n: this.props.i18n,
          log: this.props.log,
          info: this.props.info
        })));
      };

      return FileItem;
    }(Component$1);

    function _extends$4() { _extends$4 = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$4.apply(this, arguments); }

    function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

    function _inheritsLoose$2(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; _setPrototypeOf$2(subClass, superClass); }

    function _setPrototypeOf$2(o, p) { _setPrototypeOf$2 = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$2(o, p); }

    /**
     * Adapted from preact-virtual-list: https://github.com/developit/preact-virtual-list
     *
     * © 2016 Jason Miller
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in all
     * copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
     * SOFTWARE.
     *
     * Adaptations:
     * - Added role=presentation to helper elements
     * - Tweaked styles for Uppy's Dashboard use case
     */
    var h$8 = _require2.h,
        Component$2 = _require2.Component;

    var STYLE_INNER = {
      position: 'relative',
      // Disabled for our use case: the wrapper elements around FileList already deal with overflow,
      // and this additional property would hide things that we want to show.
      //
      // overflow: 'hidden',
      width: '100%',
      minHeight: '100%'
    };
    var STYLE_CONTENT = {
      position: 'absolute',
      top: 0,
      left: 0,
      // Because the `top` value gets set to some offset, this `height` being 100% would make the scrollbar
      // stretch far beyond the content. For our use case, the content div actually can get its height from
      // the elements inside it, so we don't need to specify a `height` property at all.
      //
      // height: '100%',
      width: '100%',
      overflow: 'visible'
    };

    var VirtualList = /*#__PURE__*/function (_Component) {
      _inheritsLoose$2(VirtualList, _Component);

      function VirtualList(props) {
        var _this;

        _this = _Component.call(this, props) || this; // The currently focused node, used to retain focus when the visible rows change.
        // To avoid update loops, this should not cause state updates, so it's kept as a plain property.

        _this.handleResize = function () {
          _this.resize();
        };

        _this.handleScroll = function () {
          _this.setState({
            offset: _this.base.scrollTop
          });

          if (_this.props.sync) {
            _this.forceUpdate();
          }
        };

        _this.focusElement = null;
        _this.state = {
          offset: 0,
          height: 0
        };
        return _this;
      }

      var _proto = VirtualList.prototype;

      _proto.resize = function resize() {
        if (this.state.height !== this.base.offsetHeight) {
          this.setState({
            height: this.base.offsetHeight
          });
        }
      };

      _proto.componentWillUpdate = function componentWillUpdate() {
        if (this.base.contains(document.activeElement)) {
          this.focusElement = document.activeElement;
        }
      };

      _proto.componentDidUpdate = function componentDidUpdate() {
        // Maintain focus when rows are added and removed.
        if (this.focusElement && this.focusElement.parentNode && document.activeElement !== this.focusElement) {
          this.focusElement.focus();
        }

        this.focusElement = null;
        this.resize();
      };

      _proto.componentDidMount = function componentDidMount() {
        this.resize();
        window.addEventListener('resize', this.handleResize);
      };

      _proto.componentWillUnmount = function componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);
      };

      _proto.render = function render(_ref) {
        var data = _ref.data,
            rowHeight = _ref.rowHeight,
            renderRow = _ref.renderRow,
            _ref$overscanCount = _ref.overscanCount,
            overscanCount = _ref$overscanCount === void 0 ? 10 : _ref$overscanCount,
            sync = _ref.sync,
            props = _objectWithoutPropertiesLoose(_ref, ["data", "rowHeight", "renderRow", "overscanCount", "sync"]);

        var _this$state = this.state,
            offset = _this$state.offset,
            height = _this$state.height; // first visible row index

        var start = Math.floor(offset / rowHeight); // actual number of visible rows (without overscan)

        var visibleRowCount = Math.floor(height / rowHeight); // Overscan: render blocks of rows modulo an overscan row count
        // This dramatically reduces DOM writes during scrolling

        if (overscanCount) {
          start = Math.max(0, start - start % overscanCount);
          visibleRowCount += overscanCount;
        } // last visible + overscan row index + padding to allow keyboard focus to travel past the visible area


        var end = start + visibleRowCount + 4; // data slice currently in viewport plus overscan items

        var selection = data.slice(start, end);

        var styleInner = _extends$4({}, STYLE_INNER, {
          height: data.length * rowHeight
        });

        var styleContent = _extends$4({}, STYLE_CONTENT, {
          top: start * rowHeight
        }); // The `role="presentation"` attributes ensure that these wrapper elements are not treated as list
        // items by accessibility and outline tools.


        return h$8("div", _extends$4({
          onScroll: this.handleScroll
        }, props), h$8("div", {
          role: "presentation",
          style: styleInner
        }, h$8("div", {
          role: "presentation",
          style: styleContent
        }, selection.map(renderRow))));
      };

      return VirtualList;
    }(Component$2);

    var VirtualList_1 = VirtualList;

    function _extends$5() { _extends$5 = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$5.apply(this, arguments); }







    var h$9 = _require2.h;

    function chunks(list, size) {
      var chunked = [];
      var currentChunk = [];
      list.forEach(function (item, i) {
        if (currentChunk.length < size) {
          currentChunk.push(item);
        } else {
          chunked.push(currentChunk);
          currentChunk = [item];
        }
      });
      if (currentChunk.length) chunked.push(currentChunk);
      return chunked;
    }

    var FileList = function (props) {
      var noFiles = props.totalFileCount === 0;
      var dashboardFilesClass = classnames('uppy-Dashboard-files', {
        'uppy-Dashboard-files--noFiles': noFiles
      }); // It's not great that this is hardcoded!
      // It's ESPECIALLY not great that this is checking against `itemsPerRow`!

      var rowHeight = props.itemsPerRow === 1 // Mobile
      ? 71 // 190px height + 2 * 5px margin
      : 200;
      var fileProps = {
        // FIXME This is confusing, it's actually the Dashboard's plugin ID
        id: props.id,
        error: props.error,
        // TODO move this to context
        i18n: props.i18n,
        log: props.log,
        info: props.info,
        // features
        acquirers: props.acquirers,
        resumableUploads: props.resumableUploads,
        individualCancellation: props.individualCancellation,
        // visual options
        hideRetryButton: props.hideRetryButton,
        hidePauseResumeButton: props.hidePauseResumeButton,
        hideCancelButton: props.hideCancelButton,
        showLinkToFileUploadResult: props.showLinkToFileUploadResult,
        showRemoveButtonAfterComplete: props.showRemoveButtonAfterComplete,
        isWide: props.isWide,
        metaFields: props.metaFields,
        // callbacks
        retryUpload: props.retryUpload,
        pauseUpload: props.pauseUpload,
        cancelUpload: props.cancelUpload,
        toggleFileCard: props.toggleFileCard,
        removeFile: props.removeFile,
        handleRequestThumbnail: props.handleRequestThumbnail,
        handleCancelThumbnail: props.handleCancelThumbnail
      };
      var rows = chunks(Object.keys(props.files), props.itemsPerRow);

      function renderRow(row) {
        return (// The `role="presentation` attribute ensures that the list items are properly associated with the `VirtualList` element
          // We use the first file ID as the key—this should not change across scroll rerenders
          h$9("div", {
            role: "presentation",
            key: row[0]
          }, row.map(function (fileID) {
            return h$9(FileItem, _extends$5({
              key: fileID
            }, fileProps, {
              role: "listitem",
              openFileEditor: props.openFileEditor,
              canEditFile: props.canEditFile,
              file: props.files[fileID]
            }));
          }))
        );
      }

      return h$9(VirtualList_1, {
        class: dashboardFilesClass,
        role: "list",
        data: rows,
        renderRow: renderRow,
        rowHeight: rowHeight
      });
    };

    function _inheritsLoose$3(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; _setPrototypeOf$3(subClass, superClass); }

    function _setPrototypeOf$3(o, p) { _setPrototypeOf$3 = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$3(o, p); }

    var h$a = _require2.h,
        Component$3 = _require2.Component;

    var AddFiles = /*#__PURE__*/function (_Component) {
      _inheritsLoose$3(AddFiles, _Component);

      function AddFiles() {
        var _this;

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _Component.call.apply(_Component, [this].concat(args)) || this;

        _this.triggerFileInputClick = function () {
          _this.fileInput.click();
        };

        _this.triggerFolderInputClick = function () {
          _this.folderInput.click();
        };

        _this.onFileInputChange = function (event) {
          _this.props.handleInputChange(event); // We clear the input after a file is selected, because otherwise
          // change event is not fired in Chrome and Safari when a file
          // with the same name is selected.
          // ___Why not use value="" on <input/> instead?
          //    Because if we use that method of clearing the input,
          //    Chrome will not trigger change if we drop the same file twice (Issue #768).


          event.target.value = null;
        };

        _this.renderHiddenInput = function (isFolder, refCallback) {
          return h$a("input", {
            className: "uppy-Dashboard-input",
            hidden: true,
            "aria-hidden": "true",
            tabIndex: -1,
            webkitdirectory: isFolder,
            type: "file",
            name: "files[]",
            multiple: _this.props.maxNumberOfFiles !== 1,
            onChange: _this.onFileInputChange,
            accept: _this.props.allowedFileTypes,
            ref: refCallback
          });
        };

        _this.renderMyDeviceAcquirer = function () {
          return h$a("div", {
            className: "uppy-DashboardTab",
            role: "presentation",
            "data-uppy-acquirer-id": "MyDevice"
          }, h$a("button", {
            type: "button",
            className: "uppy-DashboardTab-btn",
            role: "tab",
            tabIndex: 0,
            "data-uppy-super-focusable": true,
            onClick: _this.triggerFileInputClick
          }, h$a("svg", {
            "aria-hidden": "true",
            focusable: "false",
            width: "32",
            height: "32",
            viewBox: "0 0 32 32"
          }, h$a("g", {
            fill: "none",
            fillRule: "evenodd"
          }, h$a("rect", {
            className: "uppy-ProviderIconBg",
            width: "32",
            height: "32",
            rx: "16",
            fill: "#2275D7"
          }), h$a("path", {
            d: "M21.973 21.152H9.863l-1.108-5.087h14.464l-1.246 5.087zM9.935 11.37h3.958l.886 1.444a.673.673 0 0 0 .585.316h6.506v1.37H9.935v-3.13zm14.898 3.44a.793.793 0 0 0-.616-.31h-.978v-2.126c0-.379-.275-.613-.653-.613H15.75l-.886-1.445a.673.673 0 0 0-.585-.316H9.232c-.378 0-.667.209-.667.587V14.5h-.782a.793.793 0 0 0-.61.303.795.795 0 0 0-.155.663l1.45 6.633c.078.36.396.618.764.618h13.354c.36 0 .674-.246.76-.595l1.631-6.636a.795.795 0 0 0-.144-.675z",
            fill: "#FFF"
          }))), h$a("div", {
            className: "uppy-DashboardTab-name"
          }, _this.props.i18n('myDevice'))));
        };

        _this.renderBrowseButton = function (text, onClickFn) {
          var numberOfAcquirers = _this.props.acquirers.length;
          return h$a("button", {
            type: "button",
            className: "uppy-u-reset uppy-Dashboard-browse",
            onClick: onClickFn,
            "data-uppy-super-focusable": numberOfAcquirers === 0
          }, text);
        };

        _this.renderDropPasteBrowseTagline = function () {
          var numberOfAcquirers = _this.props.acquirers.length; // in order to keep the i18n CamelCase and options lower (as are defaults) we will want to transform a lower
          // to Camel

          var lowerFMSelectionType = _this.props.fileManagerSelectionType;
          var camelFMSelectionType = lowerFMSelectionType.charAt(0).toUpperCase() + lowerFMSelectionType.slice(1); // For backwards compatibility, we need to support both 'browse' and 'browseFiles'/'browseFolders' as strings here.

          var browseText = 'browse';
          var browseFilesText = 'browse';
          var browseFoldersText = 'browse';

          if (lowerFMSelectionType === 'files') {
            try {
              browseText = _this.props.i18n('browse');
              browseFilesText = _this.props.i18n('browse');
              browseFoldersText = _this.props.i18n('browse');
            } catch (_unused) {// Ignore, hopefully we can use the 'browseFiles' / 'browseFolders' strings
            }
          }

          try {
            browseFilesText = _this.props.i18n('browseFiles');
            browseFoldersText = _this.props.i18n('browseFolders');
          } catch (_unused2) {// Ignore, use the 'browse' string
          }

          var browse = _this.renderBrowseButton(browseText, _this.triggerFileInputClick);

          var browseFiles = _this.renderBrowseButton(browseFilesText, _this.triggerFileInputClick);

          var browseFolders = _this.renderBrowseButton(browseFoldersText, _this.triggerFolderInputClick); // Before the `fileManagerSelectionType` feature existed, we had two possible
          // strings here, but now we have six. We use the new-style strings by default:


          var titleText;

          if (numberOfAcquirers > 0) {
            titleText = _this.props.i18nArray("dropPasteImport" + camelFMSelectionType, {
              browseFiles: browseFiles,
              browseFolders: browseFolders,
              browse: browse
            });
          } else {
            titleText = _this.props.i18nArray("dropPaste" + camelFMSelectionType, {
              browseFiles: browseFiles,
              browseFolders: browseFolders,
              browse: browse
            });
          } // We use the old-style strings if available: this implies that the user has
          // manually specified them, so they should take precedence over the new-style
          // defaults.


          if (lowerFMSelectionType === 'files') {
            try {
              if (numberOfAcquirers > 0) {
                titleText = _this.props.i18nArray('dropPasteImport', {
                  browse: browse
                });
              } else {
                titleText = _this.props.i18nArray('dropPaste', {
                  browse: browse
                });
              }
            } catch (_unused3) {// Ignore, the new-style strings will be used.
            }
          }

          if (_this.props.disableLocalFiles) {
            titleText = _this.props.i18n('importFiles');
          }

          return h$a("div", {
            className: "uppy-Dashboard-AddFiles-title"
          }, titleText);
        };

        _this.renderAcquirer = function (acquirer) {
          return h$a("div", {
            className: "uppy-DashboardTab",
            role: "presentation",
            "data-uppy-acquirer-id": acquirer.id
          }, h$a("button", {
            type: "button",
            className: "uppy-DashboardTab-btn",
            role: "tab",
            tabIndex: 0,
            "aria-controls": "uppy-DashboardContent-panel--" + acquirer.id,
            "aria-selected": _this.props.activePickerPanel.id === acquirer.id,
            "data-uppy-super-focusable": true,
            onClick: function onClick() {
              return _this.props.showPanel(acquirer.id);
            }
          }, acquirer.icon(), h$a("div", {
            className: "uppy-DashboardTab-name"
          }, acquirer.name)));
        };

        _this.renderAcquirers = function (acquirers, disableLocalFiles) {
          // Group last two buttons, so we don’t end up with
          // just one button on a new line
          var acquirersWithoutLastTwo = [].concat(acquirers);
          var lastTwoAcquirers = acquirersWithoutLastTwo.splice(acquirers.length - 2, acquirers.length);
          return h$a("div", {
            className: "uppy-Dashboard-AddFiles-list",
            role: "tablist"
          }, !disableLocalFiles && _this.renderMyDeviceAcquirer(), acquirersWithoutLastTwo.map(function (acquirer) {
            return _this.renderAcquirer(acquirer);
          }), h$a("span", {
            role: "presentation",
            style: "white-space: nowrap;"
          }, lastTwoAcquirers.map(function (acquirer) {
            return _this.renderAcquirer(acquirer);
          })));
        };

        return _this;
      }

      var _proto = AddFiles.prototype;

      _proto.renderPoweredByUppy = function renderPoweredByUppy() {
        var uppyBranding = h$a("span", null, h$a("svg", {
          "aria-hidden": "true",
          focusable: "false",
          className: "uppy-c-icon uppy-Dashboard-poweredByIcon",
          width: "11",
          height: "11",
          viewBox: "0 0 11 11"
        }, h$a("path", {
          d: "M7.365 10.5l-.01-4.045h2.612L5.5.806l-4.467 5.65h2.604l.01 4.044h3.718z",
          fillRule: "evenodd"
        })), h$a("span", {
          className: "uppy-Dashboard-poweredByUppy"
        }, "Uppy")); // Support both the old word-order-insensitive string `poweredBy` and the new word-order-sensitive string `poweredBy2`

        var linkText = this.props.i18nArray('poweredBy2', {
          backwardsCompat: this.props.i18n('poweredBy'),
          uppy: uppyBranding
        });
        return h$a("a", {
          tabIndex: "-1",
          href: "https://uppy.io",
          rel: "noreferrer noopener",
          target: "_blank",
          className: "uppy-Dashboard-poweredBy"
        }, linkText);
      };

      _proto.render = function render() {
        var _this2 = this;

        return h$a("div", {
          className: "uppy-Dashboard-AddFiles"
        }, this.renderHiddenInput(false, function (ref) {
          _this2.fileInput = ref;
        }), this.renderHiddenInput(true, function (ref) {
          _this2.folderInput = ref;
        }), this.renderDropPasteBrowseTagline(), this.props.acquirers.length > 0 && this.renderAcquirers(this.props.acquirers, this.props.disableLocalFiles), h$a("div", {
          className: "uppy-Dashboard-AddFiles-info"
        }, this.props.note && h$a("div", {
          className: "uppy-Dashboard-note"
        }, this.props.note), this.props.proudlyDisplayPoweredByUppy && this.renderPoweredByUppy(this.props)));
      };

      return AddFiles;
    }(Component$3);

    var AddFiles_1 = AddFiles;

    var h$b = _require2.h;





    var AddFilesPanel = function AddFilesPanel(props) {
      return h$b("div", {
        className: classnames('uppy-Dashboard-AddFilesPanel', props.className),
        "data-uppy-panelType": "AddFiles",
        "aria-hidden": props.showAddFilesPanel
      }, h$b("div", {
        className: "uppy-DashboardContent-bar"
      }, h$b("div", {
        className: "uppy-DashboardContent-title",
        role: "heading",
        "aria-level": "1"
      }, props.i18n('addingMoreFiles')), h$b("button", {
        className: "uppy-DashboardContent-back",
        type: "button",
        onClick: function onClick(ev) {
          return props.toggleAddFilesPanel(false);
        }
      }, props.i18n('back'))), h$b(AddFiles_1, props));
    };

    var AddFilesPanel_1 = AddFilesPanel;

    // ignore drop/paste events if they are not in input or textarea —
    // otherwise when Url plugin adds drop/paste listeners to this.el,
    // draging UI elements or pasting anything into any field triggers those events —
    // Url treats them as URLs that need to be imported
    function ignoreEvent(ev) {
      var tagName = ev.target.tagName;

      if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
        ev.stopPropagation();
        return;
      }

      ev.preventDefault();
      ev.stopPropagation();
    }

    var ignoreEvent_1 = ignoreEvent;

    var h$c = _require2.h;





    function PickerPanelContent(props) {
      return h$c("div", {
        className: classnames('uppy-DashboardContent-panel', props.className),
        role: "tabpanel",
        "data-uppy-panelType": "PickerPanel",
        id: "uppy-DashboardContent-panel--" + props.activePickerPanel.id,
        onDragOver: ignoreEvent_1,
        onDragLeave: ignoreEvent_1,
        onDrop: ignoreEvent_1,
        onPaste: ignoreEvent_1
      }, h$c("div", {
        className: "uppy-DashboardContent-bar"
      }, h$c("div", {
        className: "uppy-DashboardContent-title",
        role: "heading",
        "aria-level": "1"
      }, props.i18n('importFrom', {
        name: props.activePickerPanel.name
      })), h$c("button", {
        className: "uppy-DashboardContent-back",
        type: "button",
        onClick: props.hideAllPanels
      }, props.i18n('done'))), h$c("div", {
        className: "uppy-DashboardContent-panelBody"
      }, props.getPlugin(props.activePickerPanel.id).render(props.state)));
    }

    var PickerPanelContent_1 = PickerPanelContent;

    var h$d = _require2.h;



    function EditorPanel(props) {
      var file = this.props.files[this.props.fileCardFor];
      return h$d("div", {
        className: classnames('uppy-DashboardContent-panel', props.className),
        role: "tabpanel",
        "data-uppy-panelType": "FileEditor",
        id: "uppy-DashboardContent-panel--editor"
      }, h$d("div", {
        className: "uppy-DashboardContent-bar"
      }, h$d("div", {
        className: "uppy-DashboardContent-title",
        role: "heading",
        "aria-level": "1"
      }, props.i18nArray('editing', {
        file: h$d("span", {
          className: "uppy-DashboardContent-titleFile"
        }, file.meta ? file.meta.name : file.name)
      })), h$d("button", {
        className: "uppy-DashboardContent-back",
        type: "button",
        onClick: props.hideAllPanels
      }, props.i18n('done'))), h$d("div", {
        className: "uppy-DashboardContent-panelBody"
      }, props.editors.map(function (target) {
        return props.getPlugin(target.id).render(props.state);
      })));
    }

    var EditorPanel_1 = EditorPanel;

    var h$e = _require2.h;

    var uploadStates = {
      STATE_ERROR: 'error',
      STATE_WAITING: 'waiting',
      STATE_PREPROCESSING: 'preprocessing',
      STATE_UPLOADING: 'uploading',
      STATE_POSTPROCESSING: 'postprocessing',
      STATE_COMPLETE: 'complete',
      STATE_PAUSED: 'paused'
    };

    function getUploadingState(isAllErrored, isAllComplete, isAllPaused, files) {
      if (files === void 0) {
        files = {};
      }

      if (isAllErrored) {
        return uploadStates.STATE_ERROR;
      }

      if (isAllComplete) {
        return uploadStates.STATE_COMPLETE;
      }

      if (isAllPaused) {
        return uploadStates.STATE_PAUSED;
      }

      var state = uploadStates.STATE_WAITING;
      var fileIDs = Object.keys(files);

      for (var i = 0; i < fileIDs.length; i++) {
        var progress = files[fileIDs[i]].progress; // If ANY files are being uploaded right now, show the uploading state.

        if (progress.uploadStarted && !progress.uploadComplete) {
          return uploadStates.STATE_UPLOADING;
        } // If files are being preprocessed AND postprocessed at this time, we show the
        // preprocess state. If any files are being uploaded we show uploading.


        if (progress.preprocess && state !== uploadStates.STATE_UPLOADING) {
          state = uploadStates.STATE_PREPROCESSING;
        } // If NO files are being preprocessed or uploaded right now, but some files are
        // being postprocessed, show the postprocess state.


        if (progress.postprocess && state !== uploadStates.STATE_UPLOADING && state !== uploadStates.STATE_PREPROCESSING) {
          state = uploadStates.STATE_POSTPROCESSING;
        }
      }

      return state;
    }

    function UploadStatus(props) {
      var uploadingState = getUploadingState(props.isAllErrored, props.isAllComplete, props.isAllPaused, props.files);

      switch (uploadingState) {
        case 'uploading':
          return props.i18n('uploadingXFiles', {
            smart_count: props.inProgressNotPausedFiles.length
          });

        case 'preprocessing':
        case 'postprocessing':
          return props.i18n('processingXFiles', {
            smart_count: props.processingFiles.length
          });

        case 'paused':
          return props.i18n('uploadPaused');

        case 'waiting':
          return props.i18n('xFilesSelected', {
            smart_count: props.newFiles.length
          });

        case 'complete':
          return props.i18n('uploadComplete');
      }
    }

    function PanelTopBar(props) {
      var allowNewUpload = props.allowNewUpload; // TODO maybe this should be done in ../index.js, then just pass that down as `allowNewUpload`

      if (allowNewUpload && props.maxNumberOfFiles) {
        allowNewUpload = props.totalFileCount < props.maxNumberOfFiles;
      }

      return h$e("div", {
        className: "uppy-DashboardContent-bar"
      }, !props.isAllComplete && !props.hideCancelButton ? h$e("button", {
        className: "uppy-DashboardContent-back",
        type: "button",
        onClick: props.cancelAll
      }, props.i18n('cancel')) : h$e("div", null), h$e("div", {
        className: "uppy-DashboardContent-title",
        role: "heading",
        "aria-level": "1"
      }, h$e(UploadStatus, props)), allowNewUpload ? h$e("button", {
        className: "uppy-DashboardContent-addMore",
        type: "button",
        "aria-label": props.i18n('addMoreFiles'),
        title: props.i18n('addMoreFiles'),
        onClick: function onClick() {
          return props.toggleAddFilesPanel(true);
        }
      }, h$e("svg", {
        "aria-hidden": "true",
        focusable: "false",
        className: "uppy-c-icon",
        width: "15",
        height: "15",
        viewBox: "0 0 15 15"
      }, h$e("path", {
        d: "M8 6.5h6a.5.5 0 0 1 .5.5v.5a.5.5 0 0 1-.5.5H8v6a.5.5 0 0 1-.5.5H7a.5.5 0 0 1-.5-.5V8h-6a.5.5 0 0 1-.5-.5V7a.5.5 0 0 1 .5-.5h6v-6A.5.5 0 0 1 7 0h.5a.5.5 0 0 1 .5.5v6z"
      })), h$e("span", {
        className: "uppy-DashboardContent-addMoreCaption"
      }, props.i18n('addMore'))) : h$e("div", null));
    }

    var PickerPanelTopBar = PanelTopBar;

    function _extends$6() { _extends$6 = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$6.apply(this, arguments); }

    function _inheritsLoose$4(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; _setPrototypeOf$4(subClass, superClass); }

    function _setPrototypeOf$4(o, p) { _setPrototypeOf$4 = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$4(o, p); }

    var h$f = _require2.h,
        Component$4 = _require2.Component;









    var FileCard = /*#__PURE__*/function (_Component) {
      _inheritsLoose$4(FileCard, _Component);

      function FileCard(props) {
        var _this;

        _this = _Component.call(this, props) || this;

        _this.saveOnEnter = function (ev) {
          if (ev.keyCode === 13) {
            ev.stopPropagation();
            ev.preventDefault();
            var file = _this.props.files[_this.props.fileCardFor];

            _this.props.saveFileCard(_this.state.formState, file.id);
          }
        };

        _this.updateMeta = function (newVal, name) {
          var _extends2;

          _this.setState({
            formState: _extends$6({}, _this.state.formState, (_extends2 = {}, _extends2[name] = newVal, _extends2))
          });
        };

        _this.handleSave = function () {
          var fileID = _this.props.fileCardFor;

          _this.props.saveFileCard(_this.state.formState, fileID);
        };

        _this.handleCancel = function () {
          _this.props.toggleFileCard(false);
        };

        _this.renderMetaFields = function () {
          var metaFields = _this.getMetaFields() || [];
          var fieldCSSClasses = {
            text: 'uppy-u-reset uppy-c-textInput uppy-Dashboard-FileCard-input'
          };
          return metaFields.map(function (field) {
            var id = "uppy-Dashboard-FileCard-input-" + field.id;
            return h$f("fieldset", {
              key: field.id,
              className: "uppy-Dashboard-FileCard-fieldset"
            }, h$f("label", {
              className: "uppy-Dashboard-FileCard-label",
              htmlFor: id
            }, field.name), field.render !== undefined ? field.render({
              value: _this.state.formState[field.id],
              onChange: function onChange(newVal) {
                return _this.updateMeta(newVal, field.id);
              },
              fieldCSSClasses: fieldCSSClasses
            }, h$f) : h$f("input", {
              className: fieldCSSClasses.text,
              id: id,
              type: field.type || 'text',
              value: _this.state.formState[field.id],
              placeholder: field.placeholder,
              onKeyUp: _this.saveOnEnter,
              onKeyDown: _this.saveOnEnter,
              onKeyPress: _this.saveOnEnter,
              onInput: function onInput(ev) {
                return _this.updateMeta(ev.target.value, field.id);
              },
              "data-uppy-super-focusable": true
            }));
          });
        };

        var _file = _this.props.files[_this.props.fileCardFor];

        var _metaFields = _this.getMetaFields() || [];

        var storedMetaData = {};

        _metaFields.forEach(function (field) {
          storedMetaData[field.id] = _file.meta[field.id] || '';
        });

        _this.state = {
          formState: storedMetaData
        };
        return _this;
      }

      var _proto = FileCard.prototype;

      _proto.getMetaFields = function getMetaFields() {
        return typeof this.props.metaFields === 'function' ? this.props.metaFields(this.props.files[this.props.fileCardFor]) : this.props.metaFields;
      };

      _proto.render = function render() {
        var _this2 = this;

        var file = this.props.files[this.props.fileCardFor];
        var showEditButton = this.props.canEditFile(file);
        return h$f("div", {
          className: classnames('uppy-Dashboard-FileCard', this.props.className),
          "data-uppy-panelType": "FileCard",
          onDragOver: ignoreEvent_1,
          onDragLeave: ignoreEvent_1,
          onDrop: ignoreEvent_1,
          onPaste: ignoreEvent_1
        }, h$f("div", {
          className: "uppy-DashboardContent-bar"
        }, h$f("div", {
          className: "uppy-DashboardContent-title",
          role: "heading",
          "aria-level": "1"
        }, this.props.i18nArray('editing', {
          file: h$f("span", {
            className: "uppy-DashboardContent-titleFile"
          }, file.meta ? file.meta.name : file.name)
        })), h$f("button", {
          className: "uppy-DashboardContent-back",
          type: "button",
          title: this.props.i18n('finishEditingFile'),
          onClick: this.handleSave
        }, this.props.i18n('done'))), h$f("div", {
          className: "uppy-Dashboard-FileCard-inner"
        }, h$f("div", {
          className: "uppy-Dashboard-FileCard-preview",
          style: {
            backgroundColor: getFileTypeIcon(file.type).color
          }
        }, h$f(FilePreview, {
          file: file
        }), showEditButton && h$f("button", {
          type: "button",
          className: "uppy-u-reset uppy-c-btn uppy-Dashboard-FileCard-edit",
          onClick: function onClick() {
            return _this2.props.openFileEditor(file);
          }
        }, this.props.i18n('editFile'))), h$f("div", {
          className: "uppy-Dashboard-FileCard-info"
        }, this.renderMetaFields()), h$f("div", {
          className: "uppy-Dashboard-FileCard-actions"
        }, h$f("button", {
          className: "uppy-u-reset uppy-c-btn uppy-c-btn-primary uppy-Dashboard-FileCard-actionsBtn",
          type: "button",
          onClick: this.handleSave
        }, this.props.i18n('saveChanges')), h$f("button", {
          className: "uppy-u-reset uppy-c-btn uppy-c-btn-link uppy-Dashboard-FileCard-actionsBtn",
          type: "button",
          onClick: this.handleCancel
        }, this.props.i18n('cancel')))));
      };

      return FileCard;
    }(Component$4);

    var FileCard_1 = FileCard;

    function _inheritsLoose$5(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; _setPrototypeOf$5(subClass, superClass); }

    function _setPrototypeOf$5(o, p) { _setPrototypeOf$5 = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$5(o, p); }

    var cloneElement$1 = _require2.cloneElement,
        Component$5 = _require2.Component;



    var transitionName = 'uppy-transition-slideDownUp';
    var duration = 250;
    /**
     * Vertical slide transition.
     *
     * This can take a _single_ child component, which _must_ accept a `className` prop.
     *
     * Currently this is specific to the `uppy-transition-slideDownUp` transition,
     * but it should be simple to extend this for any type of single-element
     * transition by setting the CSS name and duration as props.
     */

    var Slide = /*#__PURE__*/function (_Component) {
      _inheritsLoose$5(Slide, _Component);

      function Slide(props) {
        var _this;

        _this = _Component.call(this, props) || this;
        _this.state = {
          cachedChildren: null,
          className: ''
        };
        return _this;
      }

      var _proto = Slide.prototype;

      _proto.componentWillUpdate = function componentWillUpdate(nextProps) {
        var _this2 = this;

        var cachedChildren = this.state.cachedChildren;
        var child = nextProps.children[0];
        if (cachedChildren === child) return;
        var patch = {
          cachedChildren: child
        }; // Enter transition

        if (child && !cachedChildren) {
          patch.className = transitionName + "-enter";
          cancelAnimationFrame(this.animationFrame);
          clearTimeout(this.leaveTimeout);
          this.leaveTimeout = undefined;
          this.animationFrame = requestAnimationFrame(function () {
            // Force it to render before we add the active class
            _this2.base.getBoundingClientRect();

            _this2.setState({
              className: transitionName + "-enter " + transitionName + "-enter-active"
            });

            _this2.enterTimeout = setTimeout(function () {
              _this2.setState({
                className: ''
              });
            }, duration);
          });
        } // Leave transition


        if (cachedChildren && !child && this.leaveTimeout === undefined) {
          patch.cachedChildren = cachedChildren;
          patch.className = transitionName + "-leave";
          cancelAnimationFrame(this.animationFrame);
          clearTimeout(this.enterTimeout);
          this.enterTimeout = undefined;
          this.animationFrame = requestAnimationFrame(function () {
            _this2.setState({
              className: transitionName + "-leave " + transitionName + "-leave-active"
            });

            _this2.leaveTimeout = setTimeout(function () {
              _this2.setState({
                cachedChildren: null,
                className: ''
              });
            }, duration);
          });
        }

        this.setState(patch);
      };

      _proto.render = function render() {
        var _this$state = this.state,
            cachedChildren = _this$state.cachedChildren,
            className = _this$state.className;

        if (!cachedChildren) {
          return null;
        }

        return cloneElement$1(cachedChildren, {
          className: classnames(className, cachedChildren.attributes.className)
        });
      };

      return Slide;
    }(Component$5);

    var Slide_1 = Slide;

    /**
     * Checks if the browser supports Drag & Drop (not supported on mobile devices, for example).
     *
     * @returns {boolean}
     */
    var isDragDropSupported = function isDragDropSupported() {
      var div = document.createElement('div');

      if (!('draggable' in div) || !('ondragstart' in div && 'ondrop' in div)) {
        return false;
      }

      if (!('FormData' in window)) {
        return false;
      }

      if (!('FileReader' in window)) {
        return false;
      }

      return true;
    };

    function _extends$7() { _extends$7 = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$7.apply(this, arguments); }





















    var h$g = _require2.h; // http://dev.edenspiekermann.com/2016/02/11/introducing-accessible-modal-dialog
    // https://github.com/ghosh/micromodal


    var WIDTH_XL = 900;
    var WIDTH_LG = 700;
    var WIDTH_MD = 576;
    var HEIGHT_MD = 400;

    var Dashboard = function Dashboard(props) {
      var noFiles = props.totalFileCount === 0;
      var isSizeMD = props.containerWidth > WIDTH_MD;
      var wrapperClassName = classnames({
        'uppy-Root': props.isTargetDOMEl
      });
      var dashboardClassName = classnames({
        'uppy-Dashboard': true,
        'uppy-Dashboard--isDisabled': props.disabled,
        'uppy-Dashboard--animateOpenClose': props.animateOpenClose,
        'uppy-Dashboard--isClosing': props.isClosing,
        'uppy-Dashboard--isDraggingOver': props.isDraggingOver,
        'uppy-Dashboard--modal': !props.inline,
        'uppy-size--md': props.containerWidth > WIDTH_MD,
        'uppy-size--lg': props.containerWidth > WIDTH_LG,
        'uppy-size--xl': props.containerWidth > WIDTH_XL,
        'uppy-size--height-md': props.containerHeight > HEIGHT_MD,
        'uppy-Dashboard--isAddFilesPanelVisible': props.showAddFilesPanel,
        'uppy-Dashboard--isInnerWrapVisible': props.areInsidesReadyToBeVisible
      }); // Important: keep these in sync with the percent width values in `src/components/FileItem/index.scss`.

      var itemsPerRow = 1; // mobile

      if (props.containerWidth > WIDTH_XL) {
        itemsPerRow = 5;
      } else if (props.containerWidth > WIDTH_LG) {
        itemsPerRow = 4;
      } else if (props.containerWidth > WIDTH_MD) {
        itemsPerRow = 3;
      }

      var showFileList = props.showSelectedFiles && !noFiles;
      var dashboard = h$g("div", {
        className: dashboardClassName,
        "data-uppy-theme": props.theme,
        "data-uppy-num-acquirers": props.acquirers.length,
        "data-uppy-drag-drop-supported": !props.disableLocalFiles && isDragDropSupported(),
        "aria-hidden": props.inline ? 'false' : props.isHidden,
        "aria-disabled": props.disabled,
        "aria-label": !props.inline ? props.i18n('dashboardWindowTitle') : props.i18n('dashboardTitle'),
        onPaste: props.handlePaste,
        onDragOver: props.handleDragOver,
        onDragLeave: props.handleDragLeave,
        onDrop: props.handleDrop
      }, h$g("div", {
        className: "uppy-Dashboard-overlay",
        tabIndex: -1,
        onClick: props.handleClickOutside
      }), h$g("div", {
        className: "uppy-Dashboard-inner",
        "aria-modal": !props.inline && 'true',
        role: !props.inline && 'dialog',
        style: {
          width: props.inline && props.width ? props.width : '',
          height: props.inline && props.height ? props.height : ''
        }
      }, !props.inline ? h$g("button", {
        className: "uppy-u-reset uppy-Dashboard-close",
        type: "button",
        "aria-label": props.i18n('closeModal'),
        title: props.i18n('closeModal'),
        onClick: props.closeModal
      }, h$g("span", {
        "aria-hidden": "true"
      }, "\xD7")) : null, h$g("div", {
        className: "uppy-Dashboard-innerWrap"
      }, h$g("div", {
        className: "uppy-Dashboard-dropFilesHereHint"
      }, props.i18n('dropHint')), showFileList && h$g(PickerPanelTopBar, props), showFileList ? h$g(FileList, _extends$7({}, props, {
        itemsPerRow: itemsPerRow
      })) : h$g(AddFiles_1, _extends$7({}, props, {
        isSizeMD: isSizeMD
      })), h$g(Slide_1, null, props.showAddFilesPanel ? h$g(AddFilesPanel_1, _extends$7({
        key: "AddFiles"
      }, props, {
        isSizeMD: isSizeMD
      })) : null), h$g(Slide_1, null, props.fileCardFor ? h$g(FileCard_1, _extends$7({
        key: "FileCard"
      }, props)) : null), h$g(Slide_1, null, props.activePickerPanel ? h$g(PickerPanelContent_1, _extends$7({
        key: "Picker"
      }, props)) : null), h$g(Slide_1, null, props.showFileEditor ? h$g(EditorPanel_1, _extends$7({
        key: "Editor"
      }, props)) : null), h$g("div", {
        className: "uppy-Dashboard-progressindicators"
      }, props.progressindicators.map(function (target) {
        return props.getPlugin(target.id).render(props.state);
      })))));
      return (// Wrap it for RTL language support
        h$g("div", {
          className: wrapperClassName,
          dir: props.direction
        }, dashboard)
      );
    };

    var StatusBarStates = {
      STATE_ERROR: 'error',
      STATE_WAITING: 'waiting',
      STATE_PREPROCESSING: 'preprocessing',
      STATE_UPLOADING: 'uploading',
      STATE_POSTPROCESSING: 'postprocessing',
      STATE_COMPLETE: 'complete'
    };

    var secondsToTime = function secondsToTime(rawSeconds) {
      var hours = Math.floor(rawSeconds / 3600) % 24;
      var minutes = Math.floor(rawSeconds / 60) % 60;
      var seconds = Math.floor(rawSeconds % 60);
      return {
        hours: hours,
        minutes: minutes,
        seconds: seconds
      };
    };

    var prettyETA = function prettyETA(seconds) {
      var time = secondsToTime(seconds); // Only display hours and minutes if they are greater than 0 but always
      // display minutes if hours is being displayed
      // Display a leading zero if the there is a preceding unit: 1m 05s, but 5s

      var hoursStr = time.hours ? time.hours + "h " : '';
      var minutesVal = time.hours ? ("0" + time.minutes).substr(-2) : time.minutes;
      var minutesStr = minutesVal ? minutesVal + "m" : '';
      var secondsVal = minutesVal ? ("0" + time.seconds).substr(-2) : time.seconds;
      var secondsStr = time.hours ? '' : minutesVal ? " " + secondsVal + "s" : secondsVal + "s";
      return "" + hoursStr + minutesStr + secondsStr;
    };

    function _extends$8() { _extends$8 = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$8.apply(this, arguments); }











    var h$h = _require2.h;

    function calculateProcessingProgress(files) {
      // Collect pre or postprocessing progress states.
      var progresses = [];
      Object.keys(files).forEach(function (fileID) {
        var progress = files[fileID].progress;

        if (progress.preprocess) {
          progresses.push(progress.preprocess);
        }

        if (progress.postprocess) {
          progresses.push(progress.postprocess);
        }
      }); // In the future we should probably do this differently. For now we'll take the
      // mode and message from the first file…

      var _progresses$ = progresses[0],
          mode = _progresses$.mode,
          message = _progresses$.message;
      var value = progresses.filter(isDeterminate).reduce(function (total, progress, index, all) {
        return total + progress.value / all.length;
      }, 0);

      function isDeterminate(progress) {
        return progress.mode === 'determinate';
      }

      return {
        mode: mode,
        message: message,
        value: value
      };
    }

    function togglePauseResume(props) {
      if (props.isAllComplete) return;

      if (!props.resumableUploads) {
        return props.cancelAll();
      }

      if (props.isAllPaused) {
        return props.resumeAll();
      }

      return props.pauseAll();
    }

    var StatusBar = function (props) {
      props = props || {};
      var _props = props,
          newFiles = _props.newFiles,
          allowNewUpload = _props.allowNewUpload,
          isUploadInProgress = _props.isUploadInProgress,
          isAllPaused = _props.isAllPaused,
          resumableUploads = _props.resumableUploads,
          error = _props.error,
          hideUploadButton = _props.hideUploadButton,
          hidePauseResumeButton = _props.hidePauseResumeButton,
          hideCancelButton = _props.hideCancelButton,
          hideRetryButton = _props.hideRetryButton;
      var uploadState = props.uploadState;
      var progressValue = props.totalProgress;
      var progressMode;
      var progressBarContent;

      if (uploadState === StatusBarStates.STATE_PREPROCESSING || uploadState === StatusBarStates.STATE_POSTPROCESSING) {
        var progress = calculateProcessingProgress(props.files);
        progressMode = progress.mode;

        if (progressMode === 'determinate') {
          progressValue = progress.value * 100;
        }

        progressBarContent = ProgressBarProcessing(progress);
      } else if (uploadState === StatusBarStates.STATE_COMPLETE) {
        progressBarContent = ProgressBarComplete(props);
      } else if (uploadState === StatusBarStates.STATE_UPLOADING) {
        if (!props.supportsUploadProgress) {
          progressMode = 'indeterminate';
          progressValue = null;
        }

        progressBarContent = ProgressBarUploading(props);
      } else if (uploadState === StatusBarStates.STATE_ERROR) {
        progressValue = undefined;
        progressBarContent = ProgressBarError(props);
      }

      var width = typeof progressValue === 'number' ? progressValue : 100;
      var isHidden = uploadState === StatusBarStates.STATE_WAITING && props.hideUploadButton || uploadState === StatusBarStates.STATE_WAITING && !props.newFiles > 0 || uploadState === StatusBarStates.STATE_COMPLETE && props.hideAfterFinish;
      var showUploadBtn = !error && newFiles && !isUploadInProgress && !isAllPaused && allowNewUpload && !hideUploadButton;
      var showCancelBtn = !hideCancelButton && uploadState !== StatusBarStates.STATE_WAITING && uploadState !== StatusBarStates.STATE_COMPLETE;
      var showPauseResumeBtn = resumableUploads && !hidePauseResumeButton && uploadState === StatusBarStates.STATE_UPLOADING;
      var showRetryBtn = error && !hideRetryButton;
      var showDoneBtn = props.doneButtonHandler && uploadState === StatusBarStates.STATE_COMPLETE;
      var progressClassNames = "uppy-StatusBar-progress\n                           " + (progressMode ? "is-" + progressMode : '');
      var statusBarClassNames = classnames({
        'uppy-Root': props.isTargetDOMEl
      }, 'uppy-StatusBar', "is-" + uploadState);
      return h$h("div", {
        className: statusBarClassNames,
        "aria-hidden": isHidden
      }, h$h("div", {
        className: progressClassNames,
        style: {
          width: width + "%"
        },
        role: "progressbar",
        "aria-valuemin": "0",
        "aria-valuemax": "100",
        "aria-valuenow": progressValue
      }), progressBarContent, h$h("div", {
        className: "uppy-StatusBar-actions"
      }, showUploadBtn ? h$h(UploadBtn, _extends$8({}, props, {
        uploadState: uploadState
      })) : null, showRetryBtn ? h$h(RetryBtn, props) : null, showPauseResumeBtn ? h$h(PauseResumeButton, props) : null, showCancelBtn ? h$h(CancelBtn, props) : null, showDoneBtn ? h$h(DoneBtn, props) : null));
    };

    var UploadBtn = function UploadBtn(props) {
      var uploadBtnClassNames = classnames('uppy-u-reset', 'uppy-c-btn', 'uppy-StatusBar-actionBtn', 'uppy-StatusBar-actionBtn--upload', {
        'uppy-c-btn-primary': props.uploadState === StatusBarStates.STATE_WAITING
      });
      return h$h("button", {
        type: "button",
        className: uploadBtnClassNames,
        "aria-label": props.i18n('uploadXFiles', {
          smart_count: props.newFiles
        }),
        onClick: props.startUpload,
        "data-uppy-super-focusable": true
      }, props.newFiles && props.isUploadStarted ? props.i18n('uploadXNewFiles', {
        smart_count: props.newFiles
      }) : props.i18n('uploadXFiles', {
        smart_count: props.newFiles
      }));
    };

    var RetryBtn = function RetryBtn(props) {
      return h$h("button", {
        type: "button",
        className: "uppy-u-reset uppy-c-btn uppy-StatusBar-actionBtn uppy-StatusBar-actionBtn--retry",
        "aria-label": props.i18n('retryUpload'),
        onClick: props.retryAll,
        "data-uppy-super-focusable": true
      }, h$h("svg", {
        "aria-hidden": "true",
        focusable: "false",
        className: "uppy-c-icon",
        width: "8",
        height: "10",
        viewBox: "0 0 8 10"
      }, h$h("path", {
        d: "M4 2.408a2.75 2.75 0 1 0 2.75 2.75.626.626 0 0 1 1.25.018v.023a4 4 0 1 1-4-4.041V.25a.25.25 0 0 1 .389-.208l2.299 1.533a.25.25 0 0 1 0 .416l-2.3 1.533A.25.25 0 0 1 4 3.316v-.908z"
      })), props.i18n('retry'));
    };

    var CancelBtn = function CancelBtn(props) {
      return h$h("button", {
        type: "button",
        className: "uppy-u-reset uppy-StatusBar-actionCircleBtn",
        title: props.i18n('cancel'),
        "aria-label": props.i18n('cancel'),
        onClick: props.cancelAll,
        "data-uppy-super-focusable": true
      }, h$h("svg", {
        "aria-hidden": "true",
        focusable: "false",
        className: "uppy-c-icon",
        width: "16",
        height: "16",
        viewBox: "0 0 16 16"
      }, h$h("g", {
        fill: "none",
        fillRule: "evenodd"
      }, h$h("circle", {
        fill: "#888",
        cx: "8",
        cy: "8",
        r: "8"
      }), h$h("path", {
        fill: "#FFF",
        d: "M9.283 8l2.567 2.567-1.283 1.283L8 9.283 5.433 11.85 4.15 10.567 6.717 8 4.15 5.433 5.433 4.15 8 6.717l2.567-2.567 1.283 1.283z"
      }))));
    };

    var PauseResumeButton = function PauseResumeButton(props) {
      var isAllPaused = props.isAllPaused,
          i18n = props.i18n;
      var title = isAllPaused ? i18n('resume') : i18n('pause');
      return h$h("button", {
        title: title,
        "aria-label": title,
        className: "uppy-u-reset uppy-StatusBar-actionCircleBtn",
        type: "button",
        onClick: function onClick() {
          return togglePauseResume(props);
        },
        "data-uppy-super-focusable": true
      }, isAllPaused ? h$h("svg", {
        "aria-hidden": "true",
        focusable: "false",
        className: "uppy-c-icon",
        width: "16",
        height: "16",
        viewBox: "0 0 16 16"
      }, h$h("g", {
        fill: "none",
        fillRule: "evenodd"
      }, h$h("circle", {
        fill: "#888",
        cx: "8",
        cy: "8",
        r: "8"
      }), h$h("path", {
        fill: "#FFF",
        d: "M6 4.25L11.5 8 6 11.75z"
      }))) : h$h("svg", {
        "aria-hidden": "true",
        focusable: "false",
        className: "uppy-c-icon",
        width: "16",
        height: "16",
        viewBox: "0 0 16 16"
      }, h$h("g", {
        fill: "none",
        fillRule: "evenodd"
      }, h$h("circle", {
        fill: "#888",
        cx: "8",
        cy: "8",
        r: "8"
      }), h$h("path", {
        d: "M5 4.5h2v7H5v-7zm4 0h2v7H9v-7z",
        fill: "#FFF"
      }))));
    };

    var DoneBtn = function DoneBtn(props) {
      var i18n = props.i18n;
      return h$h("button", {
        type: "button",
        className: "uppy-u-reset uppy-c-btn uppy-StatusBar-actionBtn uppy-StatusBar-actionBtn--done",
        onClick: props.doneButtonHandler,
        "data-uppy-super-focusable": true
      }, i18n('done'));
    };

    var LoadingSpinner = function LoadingSpinner() {
      return h$h("svg", {
        className: "uppy-StatusBar-spinner",
        "aria-hidden": "true",
        focusable: "false",
        width: "14",
        height: "14"
      }, h$h("path", {
        d: "M13.983 6.547c-.12-2.509-1.64-4.893-3.939-5.936-2.48-1.127-5.488-.656-7.556 1.094C.524 3.367-.398 6.048.162 8.562c.556 2.495 2.46 4.52 4.94 5.183 2.932.784 5.61-.602 7.256-3.015-1.493 1.993-3.745 3.309-6.298 2.868-2.514-.434-4.578-2.349-5.153-4.84a6.226 6.226 0 0 1 2.98-6.778C6.34.586 9.74 1.1 11.373 3.493c.407.596.693 1.282.842 1.988.127.598.073 1.197.161 1.794.078.525.543 1.257 1.15.864.525-.341.49-1.05.456-1.592-.007-.15.02.3 0 0",
        fillRule: "evenodd"
      }));
    };

    var ProgressBarProcessing = function ProgressBarProcessing(props) {
      var value = Math.round(props.value * 100);
      return h$h("div", {
        className: "uppy-StatusBar-content"
      }, h$h(LoadingSpinner, null), props.mode === 'determinate' ? value + "% \xB7 " : '', props.message);
    };

    var renderDot = function renderDot() {
      return " \xB7 ";
    };

    var ProgressDetails = function ProgressDetails(props) {
      var ifShowFilesUploadedOfTotal = props.numUploads > 1;
      return h$h("div", {
        className: "uppy-StatusBar-statusSecondary"
      }, ifShowFilesUploadedOfTotal && props.i18n('filesUploadedOfTotal', {
        complete: props.complete,
        smart_count: props.numUploads
      }), h$h("span", {
        className: "uppy-StatusBar-additionalInfo"
      }, ifShowFilesUploadedOfTotal && renderDot(), props.i18n('dataUploadedOfTotal', {
        complete: prettierBytes(props.totalUploadedSize),
        total: prettierBytes(props.totalSize)
      }), renderDot(), props.i18n('xTimeLeft', {
        time: prettyETA(props.totalETA)
      })));
    };

    var UnknownProgressDetails = function UnknownProgressDetails(props) {
      return h$h("div", {
        className: "uppy-StatusBar-statusSecondary"
      }, props.i18n('filesUploadedOfTotal', {
        complete: props.complete,
        smart_count: props.numUploads
      }));
    };

    var UploadNewlyAddedFiles = function UploadNewlyAddedFiles(props) {
      var uploadBtnClassNames = classnames('uppy-u-reset', 'uppy-c-btn', 'uppy-StatusBar-actionBtn', 'uppy-StatusBar-actionBtn--uploadNewlyAdded');
      return h$h("div", {
        className: "uppy-StatusBar-statusSecondary"
      }, h$h("div", {
        className: "uppy-StatusBar-statusSecondaryHint"
      }, props.i18n('xMoreFilesAdded', {
        smart_count: props.newFiles
      })), h$h("button", {
        type: "button",
        className: uploadBtnClassNames,
        "aria-label": props.i18n('uploadXFiles', {
          smart_count: props.newFiles
        }),
        onClick: props.startUpload
      }, props.i18n('upload')));
    };

    var ThrottledProgressDetails = lodash_throttle(ProgressDetails, 500, {
      leading: true,
      trailing: true
    });

    var ProgressBarUploading = function ProgressBarUploading(props) {
      if (!props.isUploadStarted || props.isAllComplete) {
        return null;
      }

      var title = props.isAllPaused ? props.i18n('paused') : props.i18n('uploading');
      var showUploadNewlyAddedFiles = props.newFiles && props.isUploadStarted;
      return h$h("div", {
        className: "uppy-StatusBar-content",
        "aria-label": title,
        title: title
      }, !props.isAllPaused ? h$h(LoadingSpinner, null) : null, h$h("div", {
        className: "uppy-StatusBar-status"
      }, h$h("div", {
        className: "uppy-StatusBar-statusPrimary"
      }, props.supportsUploadProgress ? title + ": " + props.totalProgress + "%" : title), !props.isAllPaused && !showUploadNewlyAddedFiles && props.showProgressDetails ? props.supportsUploadProgress ? h$h(ThrottledProgressDetails, props) : h$h(UnknownProgressDetails, props) : null, showUploadNewlyAddedFiles ? h$h(UploadNewlyAddedFiles, props) : null));
    };

    var ProgressBarComplete = function ProgressBarComplete(_ref) {
      var totalProgress = _ref.totalProgress,
          i18n = _ref.i18n;
      return h$h("div", {
        className: "uppy-StatusBar-content",
        role: "status",
        title: i18n('complete')
      }, h$h("div", {
        className: "uppy-StatusBar-status"
      }, h$h("div", {
        className: "uppy-StatusBar-statusPrimary"
      }, h$h("svg", {
        "aria-hidden": "true",
        focusable: "false",
        className: "uppy-StatusBar-statusIndicator uppy-c-icon",
        width: "15",
        height: "11",
        viewBox: "0 0 15 11"
      }, h$h("path", {
        d: "M.414 5.843L1.627 4.63l3.472 3.472L13.202 0l1.212 1.213L5.1 10.528z"
      })), i18n('complete'))));
    };

    var ProgressBarError = function ProgressBarError(_ref2) {
      var error = _ref2.error,
          retryAll = _ref2.retryAll,
          hideRetryButton = _ref2.hideRetryButton,
          i18n = _ref2.i18n;

      function displayErrorAlert() {
        var errorMessage = i18n('uploadFailed') + " \n\n " + error;
        alert(errorMessage);
      }

      return h$h("div", {
        className: "uppy-StatusBar-content",
        role: "alert",
        title: i18n('uploadFailed')
      }, h$h("div", {
        className: "uppy-StatusBar-status"
      }, h$h("div", {
        className: "uppy-StatusBar-statusPrimary"
      }, h$h("svg", {
        "aria-hidden": "true",
        focusable: "false",
        className: "uppy-StatusBar-statusIndicator uppy-c-icon",
        width: "11",
        height: "11",
        viewBox: "0 0 11 11"
      }, h$h("path", {
        d: "M4.278 5.5L0 1.222 1.222 0 5.5 4.278 9.778 0 11 1.222 6.722 5.5 11 9.778 9.778 11 5.5 6.722 1.222 11 0 9.778z"
      })), i18n('uploadFailed'))), h$h("span", {
        className: "uppy-StatusBar-details",
        "aria-label": error,
        "data-microtip-position": "top-right",
        "data-microtip-size": "medium",
        role: "tooltip",
        onClick: displayErrorAlert
      }, "?"));
    };

    var getSpeed = function getSpeed(fileProgress) {
      if (!fileProgress.bytesUploaded) return 0;
      var timeElapsed = new Date() - fileProgress.uploadStarted;
      var uploadSpeed = fileProgress.bytesUploaded / (timeElapsed / 1000);
      return uploadSpeed;
    };

    var getBytesRemaining = function getBytesRemaining(fileProgress) {
      return fileProgress.bytesTotal - fileProgress.bytesUploaded;
    };

    /**
     * Get the declared text direction for an element.
     *
     * @param {Node} element
     * @returns {string|undefined}
     */
    function getTextDirection(element) {
      // There is another way to determine text direction using getComputedStyle(), as done here:
      // https://github.com/pencil-js/text-direction/blob/2a235ce95089b3185acec3b51313cbba921b3811/text-direction.js
      //
      // We do not use that approach because we are interested specifically in the _declared_ text direction.
      // If no text direction is declared, we have to provide our own explicit text direction so our
      // bidirectional CSS style sheets work.
      while (element && !element.dir) {
        element = element.parentNode;
      }

      return element ? element.dir : undefined;
    }

    var getTextDirection_1 = getTextDirection;

    var _class, _temp;

    function _extends$9() { _extends$9 = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$9.apply(this, arguments); }

    function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _inheritsLoose$6(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; _setPrototypeOf$6(subClass, superClass); }

    function _setPrototypeOf$6(o, p) { _setPrototypeOf$6 = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$6(o, p); }

    var Plugin$1 = lib$1.Plugin;












    /**
     * StatusBar: renders a status bar with upload/pause/resume/cancel/retry buttons,
     * progress percentage and time remaining.
     */


    var lib$2 = (_temp = _class = /*#__PURE__*/function (_Plugin) {
      _inheritsLoose$6(StatusBar$1, _Plugin);

      function StatusBar$1(uppy, opts) {
        var _this;

        _this = _Plugin.call(this, uppy, opts) || this;

        _this.startUpload = function () {
          return _this.uppy.upload().catch(function () {// Error logged in Core
          });
        };

        _this.id = _this.opts.id || 'StatusBar';
        _this.title = 'StatusBar';
        _this.type = 'progressindicator';
        _this.defaultLocale = {
          strings: {
            uploading: 'Uploading',
            upload: 'Upload',
            complete: 'Complete',
            uploadFailed: 'Upload failed',
            paused: 'Paused',
            retry: 'Retry',
            retryUpload: 'Retry upload',
            cancel: 'Cancel',
            pause: 'Pause',
            resume: 'Resume',
            done: 'Done',
            filesUploadedOfTotal: {
              0: '%{complete} of %{smart_count} file uploaded',
              1: '%{complete} of %{smart_count} files uploaded'
            },
            dataUploadedOfTotal: '%{complete} of %{total}',
            xTimeLeft: '%{time} left',
            uploadXFiles: {
              0: 'Upload %{smart_count} file',
              1: 'Upload %{smart_count} files'
            },
            uploadXNewFiles: {
              0: 'Upload +%{smart_count} file',
              1: 'Upload +%{smart_count} files'
            },
            xMoreFilesAdded: {
              0: '%{smart_count} more file added',
              1: '%{smart_count} more files added'
            }
          }
        }; // set default options

        var defaultOptions = {
          target: 'body',
          hideUploadButton: false,
          hideRetryButton: false,
          hidePauseResumeButton: false,
          hideCancelButton: false,
          showProgressDetails: false,
          hideAfterFinish: true,
          doneButtonHandler: null
        };
        _this.opts = _extends$9({}, defaultOptions, opts);

        _this.i18nInit();

        _this.render = _this.render.bind(_assertThisInitialized(_this));
        _this.install = _this.install.bind(_assertThisInitialized(_this));
        return _this;
      }

      var _proto = StatusBar$1.prototype;

      _proto.setOptions = function setOptions(newOpts) {
        _Plugin.prototype.setOptions.call(this, newOpts);

        this.i18nInit();
      };

      _proto.i18nInit = function i18nInit() {
        this.translator = new Translator([this.defaultLocale, this.uppy.locale, this.opts.locale]);
        this.i18n = this.translator.translate.bind(this.translator);
        this.setPluginState(); // so that UI re-renders and we see the updated locale
      };

      _proto.getTotalSpeed = function getTotalSpeed(files) {
        var totalSpeed = 0;
        files.forEach(function (file) {
          totalSpeed += getSpeed(file.progress);
        });
        return totalSpeed;
      };

      _proto.getTotalETA = function getTotalETA(files) {
        var totalSpeed = this.getTotalSpeed(files);

        if (totalSpeed === 0) {
          return 0;
        }

        var totalBytesRemaining = files.reduce(function (total, file) {
          return total + getBytesRemaining(file.progress);
        }, 0);
        return Math.round(totalBytesRemaining / totalSpeed * 10) / 10;
      };

      _proto.getUploadingState = function getUploadingState(isAllErrored, isAllComplete, files) {
        if (isAllErrored) {
          return StatusBarStates.STATE_ERROR;
        }

        if (isAllComplete) {
          return StatusBarStates.STATE_COMPLETE;
        }

        var state = StatusBarStates.STATE_WAITING;
        var fileIDs = Object.keys(files);

        for (var i = 0; i < fileIDs.length; i++) {
          var progress = files[fileIDs[i]].progress; // If ANY files are being uploaded right now, show the uploading state.

          if (progress.uploadStarted && !progress.uploadComplete) {
            return StatusBarStates.STATE_UPLOADING;
          } // If files are being preprocessed AND postprocessed at this time, we show the
          // preprocess state. If any files are being uploaded we show uploading.


          if (progress.preprocess && state !== StatusBarStates.STATE_UPLOADING) {
            state = StatusBarStates.STATE_PREPROCESSING;
          } // If NO files are being preprocessed or uploaded right now, but some files are
          // being postprocessed, show the postprocess state.


          if (progress.postprocess && state !== StatusBarStates.STATE_UPLOADING && state !== StatusBarStates.STATE_PREPROCESSING) {
            state = StatusBarStates.STATE_POSTPROCESSING;
          }
        }

        return state;
      };

      _proto.render = function render(state) {
        var capabilities = state.capabilities,
            files = state.files,
            allowNewUpload = state.allowNewUpload,
            totalProgress = state.totalProgress,
            error = state.error; // TODO: move this to Core, to share between Status Bar and Dashboard
        // (and any other plugin that might need it, too)

        var filesArray = Object.keys(files).map(function (file) {
          return files[file];
        });
        var newFiles = filesArray.filter(function (file) {
          return !file.progress.uploadStarted && !file.progress.preprocess && !file.progress.postprocess;
        });
        var uploadStartedFiles = filesArray.filter(function (file) {
          return file.progress.uploadStarted;
        });
        var pausedFiles = uploadStartedFiles.filter(function (file) {
          return file.isPaused;
        });
        var completeFiles = filesArray.filter(function (file) {
          return file.progress.uploadComplete;
        });
        var erroredFiles = filesArray.filter(function (file) {
          return file.error;
        });
        var inProgressFiles = filesArray.filter(function (file) {
          return !file.progress.uploadComplete && file.progress.uploadStarted;
        });
        var inProgressNotPausedFiles = inProgressFiles.filter(function (file) {
          return !file.isPaused;
        });
        var startedFiles = filesArray.filter(function (file) {
          return file.progress.uploadStarted || file.progress.preprocess || file.progress.postprocess;
        });
        var processingFiles = filesArray.filter(function (file) {
          return file.progress.preprocess || file.progress.postprocess;
        });
        var totalETA = this.getTotalETA(inProgressNotPausedFiles);
        var totalSize = 0;
        var totalUploadedSize = 0;
        startedFiles.forEach(function (file) {
          totalSize += file.progress.bytesTotal || 0;
          totalUploadedSize += file.progress.bytesUploaded || 0;
        });
        var isUploadStarted = startedFiles.length > 0;
        var isAllComplete = totalProgress === 100 && completeFiles.length === Object.keys(files).length && processingFiles.length === 0;
        var isAllErrored = error && erroredFiles.length === filesArray.length;
        var isAllPaused = inProgressFiles.length !== 0 && pausedFiles.length === inProgressFiles.length;
        var isUploadInProgress = inProgressFiles.length > 0;
        var resumableUploads = capabilities.resumableUploads || false;
        var supportsUploadProgress = capabilities.uploadProgress !== false;
        return StatusBar({
          error: error,
          uploadState: this.getUploadingState(isAllErrored, isAllComplete, state.files || {}),
          allowNewUpload: allowNewUpload,
          totalProgress: totalProgress,
          totalSize: totalSize,
          totalUploadedSize: totalUploadedSize,
          isAllComplete: isAllComplete,
          isAllPaused: isAllPaused,
          isAllErrored: isAllErrored,
          isUploadStarted: isUploadStarted,
          isUploadInProgress: isUploadInProgress,
          complete: completeFiles.length,
          newFiles: newFiles.length,
          numUploads: startedFiles.length,
          totalETA: totalETA,
          files: files,
          i18n: this.i18n,
          pauseAll: this.uppy.pauseAll,
          resumeAll: this.uppy.resumeAll,
          retryAll: this.uppy.retryAll,
          cancelAll: this.uppy.cancelAll,
          startUpload: this.startUpload,
          doneButtonHandler: this.opts.doneButtonHandler,
          resumableUploads: resumableUploads,
          supportsUploadProgress: supportsUploadProgress,
          showProgressDetails: this.opts.showProgressDetails,
          hideUploadButton: this.opts.hideUploadButton,
          hideRetryButton: this.opts.hideRetryButton,
          hidePauseResumeButton: this.opts.hidePauseResumeButton,
          hideCancelButton: this.opts.hideCancelButton,
          hideAfterFinish: this.opts.hideAfterFinish,
          isTargetDOMEl: this.isTargetDOMEl
        });
      };

      _proto.onMount = function onMount() {
        // Set the text direction if the page has not defined one.
        var element = this.el;
        var direction = getTextDirection_1(element);

        if (!direction) {
          element.dir = 'ltr';
        }
      };

      _proto.install = function install() {
        var target = this.opts.target;

        if (target) {
          this.mount(target, this);
        }
      };

      _proto.uninstall = function uninstall() {
        this.unmount();
      };

      return StatusBar$1;
    }(Plugin$1), _class.VERSION = "1.9.3", _temp);

    var _class$1, _temp$1;

    function _extends$a() { _extends$a = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$a.apply(this, arguments); }

    function _inheritsLoose$7(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; _setPrototypeOf$7(subClass, superClass); }

    function _setPrototypeOf$7(o, p) { _setPrototypeOf$7 = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$7(o, p); }

    var Plugin$2 = lib$1.Plugin;

    var h$i = _require2.h;
    /**
     * Informer
     * Shows rad message bubbles
     * used like this: `uppy.info('hello world', 'info', 5000)`
     * or for errors: `uppy.info('Error uploading img.jpg', 'error', 5000)`
     *
     */


    var lib$3 = (_temp$1 = _class$1 = /*#__PURE__*/function (_Plugin) {
      _inheritsLoose$7(Informer, _Plugin);

      function Informer(uppy, opts) {
        var _this;

        _this = _Plugin.call(this, uppy, opts) || this;

        _this.render = function (state) {
          var _state$info = state.info,
              isHidden = _state$info.isHidden,
              message = _state$info.message,
              details = _state$info.details;

          function displayErrorAlert() {
            var errorMessage = message + " \n\n " + details;
            alert(errorMessage);
          }

          var handleMouseOver = function handleMouseOver() {
            clearTimeout(_this.uppy.infoTimeoutID);
          };

          var handleMouseLeave = function handleMouseLeave() {
            _this.uppy.infoTimeoutID = setTimeout(_this.uppy.hideInfo, 2000);
          };

          return h$i("div", {
            className: "uppy uppy-Informer",
            "aria-hidden": isHidden
          }, h$i("p", {
            role: "alert"
          }, message, ' ', details && h$i("span", {
            "aria-label": details,
            "data-microtip-position": "top-left",
            "data-microtip-size": "medium",
            role: "tooltip",
            onClick: displayErrorAlert,
            onMouseOver: handleMouseOver,
            onMouseLeave: handleMouseLeave
          }, "?")));
        };

        _this.type = 'progressindicator';
        _this.id = _this.opts.id || 'Informer';
        _this.title = 'Informer'; // set default options

        var defaultOptions = {}; // merge default options with the ones set by user

        _this.opts = _extends$a({}, defaultOptions, opts);
        return _this;
      }

      var _proto = Informer.prototype;

      _proto.install = function install() {
        var target = this.opts.target;

        if (target) {
          this.mount(target, this);
        }
      };

      return Informer;
    }(Plugin$2), _class$1.VERSION = "1.6.3", _temp$1);

    var dataURItoBlob = function dataURItoBlob(dataURI, opts, toFile) {
      // get the base64 data
      var data = dataURI.split(',')[1]; // user may provide mime type, if not get it from data URI

      var mimeType = opts.mimeType || dataURI.split(',')[0].split(':')[1].split(';')[0]; // default to plain/text if data URI has no mimeType

      if (mimeType == null) {
        mimeType = 'plain/text';
      }

      var binary = atob(data);
      var array = [];

      for (var i = 0; i < binary.length; i++) {
        array.push(binary.charCodeAt(i));
      }

      var bytes;

      try {
        bytes = new Uint8Array(array); // eslint-disable-line compat/compat
      } catch (err) {
        return null;
      } // Convert to a File?


      if (toFile) {
        return new File([bytes], opts.name || '', {
          type: mimeType
        });
      }

      return new Blob([bytes], {
        type: mimeType
      });
    };

    /**
     * Check if a URL string is an object URL from `URL.createObjectURL`.
     *
     * @param {string} url
     * @returns {boolean}
     */
    var isObjectURL = function isObjectURL(url) {
      return url.indexOf('blob:') === 0;
    };

    var isPreviewSupported = function isPreviewSupported(fileType) {
      if (!fileType) return false;
      var fileTypeSpecific = fileType.split('/')[1]; // list of images that browsers can preview

      if (/^(jpe?g|gif|png|svg|svg\+xml|bmp|webp|avif)$/.test(fileTypeSpecific)) {
        return true;
      }

      return false;
    };

    var mathLog2 = Math.log2 || function (x) {
    	return Math.log(x) * Math.LOG2E;
    };

    var mini_legacy_umd = createCommonjsModule(function (module, exports) {
    !function(e,t){t(exports);}(commonjsGlobal,(function(e){function t(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function n(e,t){for(var n=0;n<t.length;n++){var r=t[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(e,r.key,r);}}function r(e,t,r){return t&&n(e.prototype,t),r&&n(e,r),e}function i(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function a(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}});var n=["prototype","__proto__","caller","arguments","length","name"];Object.getOwnPropertyNames(t).forEach((function(r){-1===n.indexOf(r)&&e[r]!==t[r]&&(e[r]=t[r]);})),t&&u(e,t);}function s(e){return (s=Object.setPrototypeOf?Object.getPrototypeOf:function(e){return e.__proto__||Object.getPrototypeOf(e)})(e)}function u(e,t){return (u=Object.setPrototypeOf||function(e,t){return e.__proto__=t,e})(e,t)}function o(){if("undefined"==typeof Reflect||!Reflect.construct)return !1;if(Reflect.construct.sham)return !1;if("function"==typeof Proxy)return !0;try{return Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){}))),!0}catch(e){return !1}}function f(e,t,n){return (f=o()?Reflect.construct:function(e,t,n){var r=[null];r.push.apply(r,t);var i=new(Function.bind.apply(e,r));return n&&u(i,n.prototype),i}).apply(null,arguments)}function c(e){var t="function"==typeof Map?new Map:void 0;return (c=function(e){if(null===e||(n=e,-1===Function.toString.call(n).indexOf("[native code]")))return e;var n;if("function"!=typeof e)throw new TypeError("Super expression must either be null or a function");if(void 0!==t){if(t.has(e))return t.get(e);t.set(e,r);}function r(){return f(e,arguments,s(this).constructor)}return r.prototype=Object.create(e.prototype,{constructor:{value:r,enumerable:!1,writable:!0,configurable:!0}}),u(r,e)})(e)}function h(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}function l(e,t){return !t||"object"!=typeof t&&"function"!=typeof t?h(e):t}function d(e){var t=o();return function(){var n,r=s(e);if(t){var i=s(this).constructor;n=Reflect.construct(r,arguments,i);}else n=r.apply(this,arguments);return l(this,n)}}function v(e,t,n){return (v="undefined"!=typeof Reflect&&Reflect.get?Reflect.get:function(e,t,n){var r=function(e,t){for(;!Object.prototype.hasOwnProperty.call(e,t)&&null!==(e=s(e)););return e}(e,t);if(r){var i=Object.getOwnPropertyDescriptor(r,t);return i.get?i.get.call(n):i.value}})(e,t,n||e)}var p=Object.values||function(e){var t=[];for(var n in e)t.push(e[n]);return t},y=Object.entries||function(e){var t=[];for(var n in e)t.push([n,e[n]]);return t},g=Object.assign||function(e){for(var t=arguments.length,n=new Array(t>1?t-1:0),r=1;r<t;r++)n[r-1]=arguments[r];return n.forEach((function(t){for(var n in t)e[n]=t[n];})),e},k=Object.fromEntries||function(e){var t={};return m(e).forEach((function(e){var n=e[0],r=e[1];t[n]=r;})),t},m=Array.from||function(e){if(e instanceof P){var t=[];return e.forEach((function(e,n){return t.push([n,e])})),t}return Array.prototype.slice.call(e)};function b(e){return -1!==this.indexOf(e)}Array.prototype.includes||(Array.prototype.includes=b),String.prototype.includes||(String.prototype.includes=b),String.prototype.startsWith||(String.prototype.startsWith=function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:0;return this.substring(t,t+e.length)===e}),String.prototype.endsWith||(String.prototype.endsWith=function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:this.length;return this.substring(t-e.length,t)===e});var A="undefined"!=typeof self?self:commonjsGlobal,w=A.fetch||function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};return new Promise((function(n,r){var i=new XMLHttpRequest;if(i.open("get",e,!0),i.responseType="arraybuffer",i.onerror=r,t.headers)for(var a in t.headers)i.setRequestHeader(a,t.headers[a]);i.onload=function(){n({ok:i.status>=200&&i.status<300,status:i.status,arrayBuffer:function(){return Promise.resolve(i.response)}});},i.send(null);}))},O=function(e){var t=[];if(Object.defineProperties(t,{size:{get:function(){return this.length}},has:{value:function(e){return -1!==this.indexOf(e)}},add:{value:function(e){this.has(e)||this.push(e);}},delete:{value:function(e){if(this.has(e)){var t=this.indexOf(e);this.splice(t,1);}}}}),Array.isArray(e))for(var n=0;n<e.length;n++)t.add(e[n]);return t},S=function(e){return new P(e)},P=void 0!==A.Map&&void 0!==A.Map.prototype.keys?A.Map:function(){function e(n){if(t(this,e),this.clear(),n)for(var r=0;r<n.length;r++)this.set(n[r][0],n[r][1]);}return r(e,[{key:"clear",value:function(){this._map={},this._keys=[];}},{key:"size",get:function(){return this._keys.length}},{key:"get",value:function(e){return this._map["map_"+e]}},{key:"set",value:function(e,t){return this._map["map_"+e]=t,this._keys.indexOf(e)<0&&this._keys.push(e),this}},{key:"has",value:function(e){return this._keys.indexOf(e)>=0}},{key:"delete",value:function(e){var t=this._keys.indexOf(e);return !(t<0)&&(delete this._map["map_"+e],this._keys.splice(t,1),!0)}},{key:"keys",value:function(){return this._keys.slice(0)}},{key:"values",value:function(){var e=this;return this._keys.map((function(t){return e.get(t)}))}},{key:"entries",value:function(){var e=this;return this._keys.map((function(t){return [t,e.get(t)]}))}},{key:"forEach",value:function(e,t){for(var n=0;n<this._keys.length;n++)e.call(t,this._map["map_"+this._keys[n]],this._keys[n],this);}}]),e}(),U="undefined"!=typeof self?self:commonjsGlobal,x="undefined"!=typeof navigator,C=x&&"undefined"==typeof HTMLImageElement,B=!("undefined"==typeof commonjsGlobal||"undefined"==typeof process||!process.versions||!process.versions.node),j=U.Buffer,_=!!j;var V=function(e){return void 0!==e};function I(e){return void 0===e||(e instanceof P?0===e.size:0===p(e).filter(V).length)}function L(e){var t=new Error(e);throw delete t.stack,t}function T(e){var t=function(e){var t=0;return e.ifd0.enabled&&(t+=1024),e.exif.enabled&&(t+=2048),e.makerNote&&(t+=2048),e.userComment&&(t+=1024),e.gps.enabled&&(t+=512),e.interop.enabled&&(t+=100),e.ifd1.enabled&&(t+=1024),t+2048}(e);return e.jfif.enabled&&(t+=50),e.xmp.enabled&&(t+=2e4),e.iptc.enabled&&(t+=14e3),e.icc.enabled&&(t+=6e3),t}var z=function(e){return String.fromCharCode.apply(null,e)},F="undefined"!=typeof TextDecoder?new TextDecoder("utf-8"):void 0;function E(e){return F?F.decode(e):_?Buffer.from(e).toString("utf8"):decodeURIComponent(escape(z(e)))}var D=function(){function e(n){var r=arguments.length>1&&void 0!==arguments[1]?arguments[1]:0,i=arguments.length>2?arguments[2]:void 0,a=arguments.length>3?arguments[3]:void 0;if(t(this,e),"boolean"==typeof a&&(this.le=a),Array.isArray(n)&&(n=new Uint8Array(n)),0===n)this.byteOffset=0,this.byteLength=0;else if(n instanceof ArrayBuffer){void 0===i&&(i=n.byteLength-r);var s=new DataView(n,r,i);this._swapDataView(s);}else if(n instanceof Uint8Array||n instanceof DataView||n instanceof e){void 0===i&&(i=n.byteLength-r),(r+=n.byteOffset)+i>n.byteOffset+n.byteLength&&L("Creating view outside of available memory in ArrayBuffer");var u=new DataView(n.buffer,r,i);this._swapDataView(u);}else if("number"==typeof n){var o=new DataView(new ArrayBuffer(n));this._swapDataView(o);}else L("Invalid input argument for BufferView: "+n);}return r(e,[{key:"_swapArrayBuffer",value:function(e){this._swapDataView(new DataView(e));}},{key:"_swapBuffer",value:function(e){this._swapDataView(new DataView(e.buffer,e.byteOffset,e.byteLength));}},{key:"_swapDataView",value:function(e){this.dataView=e,this.buffer=e.buffer,this.byteOffset=e.byteOffset,this.byteLength=e.byteLength;}},{key:"_lengthToEnd",value:function(e){return this.byteLength-e}},{key:"set",value:function(t,n){var r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:e;t instanceof DataView||t instanceof e?t=new Uint8Array(t.buffer,t.byteOffset,t.byteLength):t instanceof ArrayBuffer&&(t=new Uint8Array(t)),t instanceof Uint8Array||L("BufferView.set(): Invalid data argument.");var i=this.toUint8();return i.set(t,n),new r(this,n,t.byteLength)}},{key:"subarray",value:function(t,n){return new e(this,t,n=n||this._lengthToEnd(t))}},{key:"toUint8",value:function(){return new Uint8Array(this.buffer,this.byteOffset,this.byteLength)}},{key:"getUint8Array",value:function(e,t){return new Uint8Array(this.buffer,this.byteOffset+e,t)}},{key:"getString",value:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:0,t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:this.byteLength,n=this.getUint8Array(e,t);return E(n)}},{key:"getLatin1String",value:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:0,t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:this.byteLength,n=this.getUint8Array(e,t);return z(n)}},{key:"getUnicodeString",value:function(){for(var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:0,t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:this.byteLength,n=[],r=0;r<t&&e+r<this.byteLength;r+=2)n.push(this.getUint16(e+r));return z(n)}},{key:"getInt8",value:function(e){return this.dataView.getInt8(e)}},{key:"getUint8",value:function(e){return this.dataView.getUint8(e)}},{key:"getInt16",value:function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:this.le;return this.dataView.getInt16(e,t)}},{key:"getInt32",value:function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:this.le;return this.dataView.getInt32(e,t)}},{key:"getUint16",value:function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:this.le;return this.dataView.getUint16(e,t)}},{key:"getUint32",value:function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:this.le;return this.dataView.getUint32(e,t)}},{key:"getFloat32",value:function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:this.le;return this.dataView.getFloat32(e,t)}},{key:"getFloat64",value:function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:this.le;return this.dataView.getFloat64(e,t)}},{key:"getFloat",value:function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:this.le;return this.dataView.getFloat32(e,t)}},{key:"getDouble",value:function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:this.le;return this.dataView.getFloat64(e,t)}},{key:"getUintBytes",value:function(e,t,n){switch(t){case 1:return this.getUint8(e,n);case 2:return this.getUint16(e,n);case 4:return this.getUint32(e,n);case 8:return this.getUint64&&this.getUint64(e,n)}}},{key:"getUint",value:function(e,t,n){switch(t){case 8:return this.getUint8(e,n);case 16:return this.getUint16(e,n);case 32:return this.getUint32(e,n);case 64:return this.getUint64&&this.getUint64(e,n)}}},{key:"toString",value:function(e){return this.dataView.toString(e,this.constructor.name)}},{key:"ensureChunk",value:function(){}}],[{key:"from",value:function(t,n){return t instanceof this&&t.le===n?t:new e(t,void 0,void 0,n)}}]),e}();function R(e,t){L("".concat(e," '").concat(t,"' was not loaded, try using full build of exifr."));}var N=function(e){a(i,e);var n=d(i);function i(e){var r;return t(this,i),(r=n.call(this)).kind=e,r}return r(i,[{key:"get",value:function(e,t){return this.has(e)||R(this.kind,e),t&&(e in t||function(e,t){L("Unknown ".concat(e," '").concat(t,"'."));}(this.kind,e),t[e].enabled||R(this.kind,e)),v(s(i.prototype),"get",this).call(this,e)}},{key:"keyList",value:function(){return m(this.keys())}}]),i}(c(P)),M=new N("file parser"),W=new N("segment parser"),K=new N("file reader");function H(e){return function(){for(var t=[],n=0;n<arguments.length;n++)t[n]=arguments[n];try{return Promise.resolve(e.apply(this,t))}catch(e){return Promise.reject(e)}}}function X(e,t,n){return n?t?t(e):e:(e&&e.then||(e=Promise.resolve(e)),t?e.then(t):e)}var Y=H((function(e){return new Promise((function(t,n){var r=new FileReader;r.onloadend=function(){return t(r.result||new ArrayBuffer)},r.onerror=n,r.readAsArrayBuffer(e);}))})),G=H((function(e){return w(e).then((function(e){return e.arrayBuffer()}))})),J=H((function(e,t){return X(t(e),(function(e){return new D(e)}))})),q=H((function(e,t,n){var r=new(K.get(n))(e,t);return X(r.read(),(function(){return r}))})),Q=H((function(e,t,n,r){return K.has(n)?q(e,t,n):r?J(e,r):(L("Parser ".concat(n," is not loaded")),X())})),Z="Invalid input argument";function $(e,t){return (n=e).startsWith("data:")||n.length>1e4?q(e,t,"base64"):x?Q(e,t,"url",G):B?q(e,t,"fs"):void L(Z);var n;}var ee=function(e){a(i,e);var n=d(i);function i(){return t(this,i),n.apply(this,arguments)}return r(i,[{key:"tagKeys",get:function(){return this.allKeys||(this.allKeys=m(this.keys())),this.allKeys}},{key:"tagValues",get:function(){return this.allValues||(this.allValues=m(this.values())),this.allValues}}]),i}(c(P));function te(e,t,n){var r=new ee,i=n;Array.isArray(i)||("function"==typeof i.entries&&(i=i.entries()),i=m(i));for(var a=0;a<i.length;a++){var s=i[a],u=s[0],o=s[1];r.set(u,o);}if(Array.isArray(t)){var f=t;Array.isArray(f)||("function"==typeof f.entries&&(f=f.entries()),f=m(f));for(var c=0;c<f.length;c++){var h=f[c];e.set(h,r);}}else e.set(t,r);return r}function ne(e,t,n){var r,i=e.get(t),a=n;Array.isArray(a)||("function"==typeof a.entries&&(a=a.entries()),a=m(a));for(var s=0;s<a.length;s++)r=a[s],i.set(r[0],r[1]);}var re=S(),ie=S(),ae=S(),se=37500,ue=37510,oe=33723,fe=34675,ce=34665,he=34853,le=40965,de=["chunked","firstChunkSize","firstChunkSizeNode","firstChunkSizeBrowser","chunkSize","chunkLimit"],ve=["jfif","xmp","icc","iptc","ihdr"],pe=["tiff"].concat(ve),ye=["ifd0","ifd1","exif","gps","interop"],ge=[].concat(pe,ye),ke=["makerNote","userComment"],me=["translateKeys","translateValues","reviveValues","multiSegment"],be=[].concat(me,["sanitize","mergeOutput","silentErrors"]),Ae=function(){function e(){t(this,e);}return r(e,[{key:"translate",get:function(){return this.translateKeys||this.translateValues||this.reviveValues}}]),e}(),we=function(e){a(s,e);var n=d(s);function s(e,r,a,u){var o;if(t(this,s),i(h(o=n.call(this)),"enabled",!1),i(h(o),"skip",O()),i(h(o),"pick",O()),i(h(o),"deps",O()),i(h(o),"translateKeys",!1),i(h(o),"translateValues",!1),i(h(o),"reviveValues",!1),o.key=e,o.enabled=r,o.parse=o.enabled,o.applyInheritables(u),o.canBeFiltered=ye.includes(e),o.canBeFiltered&&(o.dict=re.get(e)),void 0!==a)if(Array.isArray(a))o.parse=o.enabled=!0,o.canBeFiltered&&a.length>0&&o.translateTagSet(a,o.pick);else if("object"==typeof a){if(o.enabled=!0,o.parse=!1!==a.parse,o.canBeFiltered){var f=a.pick,c=a.skip;f&&f.length>0&&o.translateTagSet(f,o.pick),c&&c.length>0&&o.translateTagSet(c,o.skip);}o.applyInheritables(a);}else !0===a||!1===a?o.parse=o.enabled=a:L("Invalid options argument: ".concat(a));return o}return r(s,[{key:"needed",get:function(){return this.enabled||this.deps.size>0}},{key:"applyInheritables",value:function(e){var t,n,r=me;Array.isArray(r)||("function"==typeof r.entries&&(r=r.entries()),r=m(r));for(var i=0;i<r.length;i++)void 0!==(n=e[t=r[i]])&&(this[t]=n);}},{key:"translateTagSet",value:function(e,t){if(this.dict){var n,r,i=this.dict,a=i.tagKeys,s=i.tagValues,u=e;Array.isArray(u)||("function"==typeof u.entries&&(u=u.entries()),u=m(u));for(var o=0;o<u.length;o++)"string"==typeof(n=u[o])?(-1===(r=s.indexOf(n))&&(r=a.indexOf(Number(n))),-1!==r&&t.add(Number(a[r]))):t.add(n);}else {var f=e;Array.isArray(f)||("function"==typeof f.entries&&(f=f.entries()),f=m(f));for(var c=0;c<f.length;c++){var h=f[c];t.add(h);}}}},{key:"finalizeFilters",value:function(){!this.enabled&&this.deps.size>0?(this.enabled=!0,Ce(this.pick,this.deps)):this.enabled&&this.pick.size>0&&Ce(this.pick,this.deps);}}]),s}(Ae),Oe={jfif:!1,tiff:!0,xmp:!1,icc:!1,iptc:!1,ifd0:!0,ifd1:!1,exif:!0,gps:!0,interop:!1,ihdr:void 0,makerNote:!1,userComment:!1,multiSegment:!1,skip:[],pick:[],translateKeys:!0,translateValues:!0,reviveValues:!0,sanitize:!0,mergeOutput:!0,silentErrors:!0,chunked:!0,firstChunkSize:void 0,firstChunkSizeNode:512,firstChunkSizeBrowser:65536,chunkSize:65536,chunkLimit:5},Se=S(),Pe=function(e){a(i,e);var n=d(i);function i(e){var r;return t(this,i),r=n.call(this),!0===e?r.setupFromTrue():void 0===e?r.setupFromUndefined():Array.isArray(e)?r.setupFromArray(e):"object"==typeof e?r.setupFromObject(e):L("Invalid options argument ".concat(e)),void 0===r.firstChunkSize&&(r.firstChunkSize=x?r.firstChunkSizeBrowser:r.firstChunkSizeNode),r.mergeOutput&&(r.ifd1.enabled=!1),r.filterNestedSegmentTags(),r.traverseTiffDependencyTree(),r.checkLoadedPlugins(),r}return r(i,[{key:"setupFromUndefined",value:function(){var e,t=de;Array.isArray(t)||("function"==typeof t.entries&&(t=t.entries()),t=m(t));for(var n=0;n<t.length;n++)this[e=t[n]]=Oe[e];var r=be;Array.isArray(r)||("function"==typeof r.entries&&(r=r.entries()),r=m(r));for(var i=0;i<r.length;i++)this[e=r[i]]=Oe[e];var a=ke;Array.isArray(a)||("function"==typeof a.entries&&(a=a.entries()),a=m(a));for(var s=0;s<a.length;s++)this[e=a[s]]=Oe[e];var u=ge;Array.isArray(u)||("function"==typeof u.entries&&(u=u.entries()),u=m(u));for(var o=0;o<u.length;o++)this[e=u[o]]=new we(e,Oe[e],void 0,this);}},{key:"setupFromTrue",value:function(){var e,t=de;Array.isArray(t)||("function"==typeof t.entries&&(t=t.entries()),t=m(t));for(var n=0;n<t.length;n++)this[e=t[n]]=Oe[e];var r=be;Array.isArray(r)||("function"==typeof r.entries&&(r=r.entries()),r=m(r));for(var i=0;i<r.length;i++)this[e=r[i]]=Oe[e];var a=ke;Array.isArray(a)||("function"==typeof a.entries&&(a=a.entries()),a=m(a));for(var s=0;s<a.length;s++)this[e=a[s]]=!0;var u=ge;Array.isArray(u)||("function"==typeof u.entries&&(u=u.entries()),u=m(u));for(var o=0;o<u.length;o++)this[e=u[o]]=new we(e,!0,void 0,this);}},{key:"setupFromArray",value:function(e){var t,n=de;Array.isArray(n)||("function"==typeof n.entries&&(n=n.entries()),n=m(n));for(var r=0;r<n.length;r++)this[t=n[r]]=Oe[t];var i=be;Array.isArray(i)||("function"==typeof i.entries&&(i=i.entries()),i=m(i));for(var a=0;a<i.length;a++)this[t=i[a]]=Oe[t];var s=ke;Array.isArray(s)||("function"==typeof s.entries&&(s=s.entries()),s=m(s));for(var u=0;u<s.length;u++)this[t=s[u]]=Oe[t];var o=ge;Array.isArray(o)||("function"==typeof o.entries&&(o=o.entries()),o=m(o));for(var f=0;f<o.length;f++)this[t=o[f]]=new we(t,!1,void 0,this);this.setupGlobalFilters(e,void 0,ye);}},{key:"setupFromObject",value:function(e){var t;ye.ifd0=ye.ifd0||ye.image,ye.ifd1=ye.ifd1||ye.thumbnail,g(this,e);var n=de;Array.isArray(n)||("function"==typeof n.entries&&(n=n.entries()),n=m(n));for(var r=0;r<n.length;r++)this[t=n[r]]=xe(e[t],Oe[t]);var i=be;Array.isArray(i)||("function"==typeof i.entries&&(i=i.entries()),i=m(i));for(var a=0;a<i.length;a++)this[t=i[a]]=xe(e[t],Oe[t]);var s=ke;Array.isArray(s)||("function"==typeof s.entries&&(s=s.entries()),s=m(s));for(var u=0;u<s.length;u++)this[t=s[u]]=xe(e[t],Oe[t]);var o=pe;Array.isArray(o)||("function"==typeof o.entries&&(o=o.entries()),o=m(o));for(var f=0;f<o.length;f++)this[t=o[f]]=new we(t,Oe[t],e[t],this);var c=ye;Array.isArray(c)||("function"==typeof c.entries&&(c=c.entries()),c=m(c));for(var h=0;h<c.length;h++)this[t=c[h]]=new we(t,Oe[t],e[t],this.tiff);this.setupGlobalFilters(e.pick,e.skip,ye,ge),!0===e.tiff?this.batchEnableWithBool(ye,!0):!1===e.tiff?this.batchEnableWithUserValue(ye,e):Array.isArray(e.tiff)?this.setupGlobalFilters(e.tiff,void 0,ye):"object"==typeof e.tiff&&this.setupGlobalFilters(e.tiff.pick,e.tiff.skip,ye);}},{key:"batchEnableWithBool",value:function(e,t){var n=e;Array.isArray(n)||("function"==typeof n.entries&&(n=n.entries()),n=m(n));for(var r=0;r<n.length;r++){this[n[r]].enabled=t;}}},{key:"batchEnableWithUserValue",value:function(e,t){var n=e;Array.isArray(n)||("function"==typeof n.entries&&(n=n.entries()),n=m(n));for(var r=0;r<n.length;r++){var i=n[r],a=t[i];this[i].enabled=!1!==a&&void 0!==a;}}},{key:"setupGlobalFilters",value:function(e,t,n){var r=arguments.length>3&&void 0!==arguments[3]?arguments[3]:n;if(e&&e.length){var i=r;Array.isArray(i)||("function"==typeof i.entries&&(i=i.entries()),i=m(i));for(var a=0;a<i.length;a++){var s=i[a];this[s].enabled=!1;}var u=Ue(e,n),o=u;Array.isArray(o)||("function"==typeof o.entries&&(o=o.entries()),o=m(o));for(var f=0;f<o.length;f++){var c=o[f],h=c[0],l=c[1];Ce(this[h].pick,l),this[h].enabled=!0;}}else if(t&&t.length){var d=Ue(t,n),v=d;Array.isArray(v)||("function"==typeof v.entries&&(v=v.entries()),v=m(v));for(var p=0;p<v.length;p++){var y=v[p],g=y[0],k=y[1];Ce(this[g].skip,k);}}}},{key:"filterNestedSegmentTags",value:function(){var e=this.ifd0,t=this.exif,n=this.xmp,r=this.iptc,i=this.icc;this.makerNote?t.deps.add(se):t.skip.add(se),this.userComment?t.deps.add(ue):t.skip.add(ue),n.enabled||e.skip.add(700),r.enabled||e.skip.add(oe),i.enabled||e.skip.add(fe);}},{key:"traverseTiffDependencyTree",value:function(){var e=this,t=this.ifd0,n=this.exif,r=this.gps;this.interop.needed&&(n.deps.add(le),t.deps.add(le)),n.needed&&t.deps.add(ce),r.needed&&t.deps.add(he),this.tiff.enabled=ye.some((function(t){return !0===e[t].enabled}))||this.makerNote||this.userComment;var i=ye;Array.isArray(i)||("function"==typeof i.entries&&(i=i.entries()),i=m(i));for(var a=0;a<i.length;a++){this[i[a]].finalizeFilters();}}},{key:"onlyTiff",get:function(){var e=this;return !ve.map((function(t){return e[t].enabled})).some((function(e){return !0===e}))&&this.tiff.enabled}},{key:"checkLoadedPlugins",value:function(){var e=pe;Array.isArray(e)||("function"==typeof e.entries&&(e=e.entries()),e=m(e));for(var t=0;t<e.length;t++){var n=e[t];this[n].enabled&&!W.has(n)&&R("segment parser",n);}}}],[{key:"useCached",value:function(e){var t=Se.get(e);return void 0!==t||(t=new this(e),Se.set(e,t)),t}}]),i}(Ae);function Ue(e,t){var n,r,i,a=[],s=t;Array.isArray(s)||("function"==typeof s.entries&&(s=s.entries()),s=m(s));for(var u=0;u<s.length;u++){r=s[u],n=[];var o=re.get(r);Array.isArray(o)||("function"==typeof o.entries&&(o=o.entries()),o=m(o));for(var f=0;f<o.length;f++)i=o[f],(e.includes(i[0])||e.includes(i[1]))&&n.push(i[0]);n.length&&a.push([r,n]);}return a}function xe(e,t){return void 0!==e?e:void 0!==t?t:void 0}function Ce(e,t){var n=t;Array.isArray(n)||("function"==typeof n.entries&&(n=n.entries()),n=m(n));for(var r=0;r<n.length;r++){var i=n[r];e.add(i);}}function Be(e,t,n){return n?t?t(e):e:(e&&e.then||(e=Promise.resolve(e)),t?e.then(t):e)}function je(){}function _e(e,t){if(!t)return e&&e.then?e.then(je):Promise.resolve()}function Ve(e,t){var n=e();return n&&n.then?n.then(t):t(n)}i(Pe,"default",Oe);var Ie=function(){function e(n){t(this,e),i(this,"parsers",{}),this.options=Pe.useCached(n);}return r(e,[{key:"setup",value:function(){if(!this.fileParser){var e=this.file,t=e.getUint16(0),n=M;Array.isArray(n)||("function"==typeof n.entries&&(n=n.entries()),n=m(n));for(var r=0;r<n.length;r++){var i=n[r],a=i[0],s=i[1];if(s.canHandle(e,t))return this.fileParser=new s(this.options,this.file,this.parsers),e[a]=!0}L("Unknown file format");}}},{key:"read",value:function(e){try{var t=this;return Be(function(e,t){return "string"==typeof e?$(e,t):x&&!C&&e instanceof HTMLImageElement?$(e.src,t):e instanceof Uint8Array||e instanceof ArrayBuffer||e instanceof DataView?new D(e):x&&e instanceof Blob?Q(e,t,"blob",Y):void L(Z)}(e,t.options),(function(e){t.file=e;}))}catch(e){return Promise.reject(e)}}},{key:"parse",value:function(){try{var e=this;e.setup();var t={},n=[];return Ve((function(){return e.options.silentErrors?Be(e.doParse(t,n).catch((function(e){return n.push(e)})),(function(){n.push.apply(n,e.fileParser.errors);})):_e(e.doParse(t,n))}),(function(){return e.file.close&&e.file.close(),e.options.silentErrors&&n.length>0&&(t.errors=n),I(r=t)?void 0:r;var r;}))}catch(e){return Promise.reject(e)}}},{key:"doParse",value:function(e,t){try{var n=this;return Be(n.fileParser.parse(),(function(){var r,i=p(n.parsers).map((r=function(t){return Be(t.parse(),(function(n){t.assignToOutput(e,n);}))},function(){for(var e=[],t=0;t<arguments.length;t++)e[t]=arguments[t];try{return Promise.resolve(r.apply(this,e))}catch(e){return Promise.reject(e)}}));if(n.options.silentErrors){var a=function(e){return t.push(e)};i=i.map((function(e){return e.catch(a)}));}return _e(Promise.all(i))}))}catch(e){return Promise.reject(e)}}},{key:"extractThumbnail",value:function(){try{var e=this;e.setup();var t,n=e.options,r=e.file,i=W.get("tiff",n);return Ve((function(){if(!r.tiff)return function(e){var t=e();if(t&&t.then)return t.then(je)}((function(){if(r.jpeg)return Be(e.fileParser.getOrFindSegment("tiff"),(function(e){t=e;}))}));t={start:0,type:"tiff"};}),(function(){if(void 0!==t)return Be(e.fileParser.ensureSegmentChunk(t),(function(t){return Be((e.parsers.tiff=new i(t,n,r)).extractThumbnail(),(function(e){return r.close&&r.close(),e}))}))}))}catch(e){return Promise.reject(e)}}}]),e}();var Le,Te=(Le=function(e,t){var n,r,a=new Ie(t);return n=a.read(e),r=function(){return a.parse()},(n&&n.then||(n=Promise.resolve(n)),r?n.then(r):n)},function(){for(var e=[],t=0;t<arguments.length;t++)e[t]=arguments[t];try{return Promise.resolve(Le.apply(this,e))}catch(e){return Promise.reject(e)}}),ze=Object.freeze({__proto__:null,parse:Te,Exifr:Ie,fileParsers:M,segmentParsers:W,fileReaders:K,tagKeys:re,tagValues:ie,tagRevivers:ae,createDictionary:te,extendDictionary:ne,fetchUrlAsArrayBuffer:G,readBlobAsArrayBuffer:Y,chunkedProps:de,otherSegments:ve,segments:pe,tiffBlocks:ye,segmentsAndBlocks:ge,tiffExtractables:ke,inheritables:me,allFormatters:be,Options:Pe});function Fe(){}var Ee=function(){function e(n,r,a){var s=this;t(this,e),i(this,"errors",[]),i(this,"ensureSegmentChunk",function(e){return function(){for(var t=[],n=0;n<arguments.length;n++)t[n]=arguments[n];try{return Promise.resolve(e.apply(this,t))}catch(e){return Promise.reject(e)}}}((function(e){var t,n,r,i=e.start,a=e.size||65536;return t=function(){if(s.file.chunked)return function(e){var t=e();if(t&&t.then)return t.then(Fe)}((function(){if(!s.file.available(i,a))return function(e){if(e&&e.then)return e.then(Fe)}(function(e,t){try{var n=e();}catch(e){return t(e)}return n&&n.then?n.then(void 0,t):n}((function(){return t=s.file.readChunk(i,a),n=function(t){e.chunk=t;},r?n?n(t):t:(t&&t.then||(t=Promise.resolve(t)),n?t.then(n):t);var t,n,r;}),(function(t){L("Couldn't read segment: ".concat(JSON.stringify(e),". ").concat(t.message));})));e.chunk=s.file.subarray(i,a);}));s.file.byteLength>i+a?e.chunk=s.file.subarray(i,a):void 0===e.size?e.chunk=s.file.subarray(i):L("Segment unreachable: "+JSON.stringify(e));},n=function(){return e.chunk},(r=t())&&r.then?r.then(n):n(r)}))),this.extendOptions&&this.extendOptions(n),this.options=n,this.file=r,this.parsers=a;}return r(e,[{key:"injectSegment",value:function(e,t){this.options[e].enabled&&this.createParser(e,t);}},{key:"createParser",value:function(e,t){var n=new(W.get(e))(t,this.options,this.file);return this.parsers[e]=n}},{key:"createParsers",value:function(e){var t=e;Array.isArray(t)||("function"==typeof t.entries&&(t=t.entries()),t=m(t));for(var n=0;n<t.length;n++){var r=t[n],i=r.type,a=r.chunk,s=this.options[i];if(s&&s.enabled){var u=this.parsers[i];u&&u.append||u||this.createParser(i,a);}}}},{key:"readSegments",value:function(e){try{var t=e.map(this.ensureSegmentChunk);return function(e,t){if(!t)return e&&e.then?e.then(Fe):Promise.resolve()}(Promise.all(t))}catch(e){return Promise.reject(e)}}}]),e}(),De=function(){function e(n){var r=this,a=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},s=arguments.length>2?arguments[2]:void 0;t(this,e),i(this,"errors",[]),i(this,"raw",S()),i(this,"handleError",(function(e){if(!r.options.silentErrors)throw e;r.errors.push(e.message);})),this.chunk=this.normalizeInput(n),this.file=s,this.type=this.constructor.type,this.globalOptions=this.options=a,this.localOptions=a[this.type],this.canTranslate=this.localOptions&&this.localOptions.translate;}return r(e,[{key:"normalizeInput",value:function(e){return e instanceof D?e:new D(e)}},{key:"translate",value:function(){this.canTranslate&&(this.translated=this.translateBlock(this.raw,this.type));}},{key:"output",get:function(){return this.translated?this.translated:this.raw?k(this.raw):void 0}},{key:"translateBlock",value:function(e,t){var n=ae.get(t),r=ie.get(t),i=re.get(t),a=this.options[t],s=a.reviveValues&&!!n,u=a.translateValues&&!!r,o=a.translateKeys&&!!i,f={},c=e;Array.isArray(c)||("function"==typeof c.entries&&(c=c.entries()),c=m(c));for(var h=0;h<c.length;h++){var l=c[h],d=l[0],v=l[1];s&&n.has(d)?v=n.get(d)(v):u&&r.has(d)&&(v=this.translateValue(v,r.get(d))),o&&i.has(d)&&(d=i.get(d)||d),f[d]=v;}return f}},{key:"translateValue",value:function(e,t){return t[e]||t.DEFAULT||e}},{key:"assignToOutput",value:function(e,t){this.assignObjectToOutput(e,this.constructor.type,t);}},{key:"assignObjectToOutput",value:function(e,t,n){if(this.globalOptions.mergeOutput)return g(e,n);e[t]?g(e[t],n):e[t]=n;}}],[{key:"findPosition",value:function(e,t){var n=e.getUint16(t+2)+2,r="function"==typeof this.headerLength?this.headerLength(e,t,n):this.headerLength,i=t+r,a=n-r;return {offset:t,length:n,headerLength:r,start:i,size:a,end:i+a}}},{key:"parse",value:function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},n=new Pe(i({},this.type,t)),r=new this(e,n);return r.parse()}}]),e}();function Re(e,t,n){return n?t?t(e):e:(e&&e.then||(e=Promise.resolve(e)),t?e.then(t):e)}i(De,"headerLength",4),i(De,"type",void 0),i(De,"multiSegment",!1),i(De,"canHandle",(function(){return !1}));function Ne(){}function Me(e,t){if(!t)return e&&e.then?e.then(Ne):Promise.resolve()}function We(e){var t=e();if(t&&t.then)return t.then(Ne)}function Ke(e,t){var n=e();return n&&n.then?n.then(t):t(n)}function He(e,t,n){if(!e.s){if(n instanceof Xe){if(!n.s)return void(n.o=He.bind(null,e,t));1&t&&(t=n.s),n=n.v;}if(n&&n.then)return void n.then(He.bind(null,e,t),He.bind(null,e,2));e.s=t,e.v=n;var r=e.o;r&&r(e);}}var Xe=function(){function e(){}return e.prototype.then=function(t,n){var r=new e,i=this.s;if(i){var a=1&i?t:n;if(a){try{He(r,1,a(this.v));}catch(e){He(r,2,e);}return r}return this}return this.o=function(e){try{var i=e.v;1&e.s?He(r,1,t?t(i):i):n?He(r,1,n(i)):He(r,2,i);}catch(e){He(r,2,e);}},r},e}();function Ye(e){return e instanceof Xe&&1&e.s}function Ge(e,t,n){for(var r;;){var i=e();if(Ye(i)&&(i=i.v),!i)return a;if(i.then){r=0;break}var a=n();if(a&&a.then){if(!Ye(a)){r=1;break}a=a.s;}if(t){var s=t();if(s&&s.then&&!Ye(s)){r=2;break}}}var u=new Xe,o=He.bind(null,u,2);return (0===r?i.then(c):1===r?a.then(f):s.then(h)).then(void 0,o),u;function f(r){a=r;do{if(t&&(s=t())&&s.then&&!Ye(s))return void s.then(h).then(void 0,o);if(!(i=e())||Ye(i)&&!i.v)return void He(u,1,a);if(i.then)return void i.then(c).then(void 0,o);Ye(a=n())&&(a=a.v);}while(!a||!a.then);a.then(f).then(void 0,o);}function c(e){e?(a=n())&&a.then?a.then(f).then(void 0,o):f(a):He(u,1,a);}function h(){(i=e())?i.then?i.then(c).then(void 0,o):c(i):He(u,1,a);}}function Je(e){return 192===e||194===e||196===e||219===e||221===e||218===e||254===e}function qe(e){return e>=224&&e<=239}function Qe(e,t,n){var r=W;Array.isArray(r)||("function"==typeof r.entries&&(r=r.entries()),r=m(r));for(var i=0;i<r.length;i++){var a=r[i],s=a[0];if(a[1].canHandle(e,t,n))return s}}var Ze=function(e){a(s,e);var n=d(s);function s(){var e;t(this,s);for(var r=arguments.length,a=new Array(r),u=0;u<r;u++)a[u]=arguments[u];return i(h(e=n.call.apply(n,[this].concat(a))),"appSegments",[]),i(h(e),"jpegSegments",[]),i(h(e),"unknownSegments",[]),e}return r(s,[{key:"parse",value:function(){try{var e=this;return Re(e.findAppSegments(),(function(){return Re(e.readSegments(e.appSegments),(function(){e.mergeMultiSegments(),e.createParsers(e.mergedAppSegments||e.appSegments);}))}))}catch(e){return Promise.reject(e)}}},{key:"setupSegmentFinderArgs",value:function(e){var t=this;!0===e?(this.findAll=!0,this.wanted=O(W.keyList())):(e=void 0===e?W.keyList().filter((function(e){return t.options[e].enabled})):e.filter((function(e){return t.options[e].enabled&&W.has(e)})),this.findAll=!1,this.remaining=O(e),this.wanted=O(e)),this.unfinishedMultiSegment=!1;}},{key:"findAppSegments",value:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:0,t=arguments.length>1?arguments[1]:void 0;try{var n=this;n.setupSegmentFinderArgs(t);var r=n.file,i=n.findAll,a=n.wanted,s=n.remaining;return Ke((function(){if(!i&&n.file.chunked)return i=m(a).some((function(e){var t=W.get(e),r=n.options[e];return t.multiSegment&&r.multiSegment})),We((function(){if(i)return Me(n.file.readWhole())}))}),(function(){var t=!1;if(e=n.findAppSegmentsInRange(e,r.byteLength),!n.options.onlyTiff)return function(){if(r.chunked){var i=!1;return Ge((function(){return !t&&s.size>0&&!i&&(!!r.canReadNextChunk||!!n.unfinishedMultiSegment)}),void 0,(function(){var a=r.nextChunkOffset,s=n.appSegments.some((function(e){return !n.file.available(e.offset||e.start,e.length||e.size)}));return Ke((function(){return e>a&&!s?Re(r.readNextChunk(e),(function(e){i=!e;})):Re(r.readNextChunk(a),(function(e){i=!e;}))}),(function(){void 0===(e=n.findAppSegmentsInRange(e,r.byteLength))&&(t=!0);}))}))}}()}))}catch(e){return Promise.reject(e)}}},{key:"findAppSegmentsInRange",value:function(e,t){t-=2;for(var n,r,i,a,s,u,o=this.file,f=this.findAll,c=this.wanted,h=this.remaining,l=this.options;e<t;e++)if(255===o.getUint8(e))if(qe(n=o.getUint8(e+1))){if(r=o.getUint16(e+2),(i=Qe(o,e,r))&&c.has(i)&&(s=(a=W.get(i)).findPosition(o,e),u=l[i],s.type=i,this.appSegments.push(s),!f&&(a.multiSegment&&u.multiSegment?(this.unfinishedMultiSegment=s.chunkNumber<s.chunkCount,this.unfinishedMultiSegment||h.delete(i)):h.delete(i),0===h.size)))break;l.recordUnknownSegments&&((s=De.findPosition(o,e)).marker=n,this.unknownSegments.push(s)),e+=r+1;}else if(Je(n)){if(r=o.getUint16(e+2),218===n&&!1!==l.stopAfterSos)return;l.recordJpegSegments&&this.jpegSegments.push({offset:e,length:r,marker:n}),e+=r+1;}return e}},{key:"mergeMultiSegments",value:function(){var e=this;if(this.appSegments.some((function(e){return e.multiSegment}))){var t=function(e,t){for(var n,r,i,a=S(),s=0;s<e.length;s++)r=(n=e[s])[t],a.has(r)?i=a.get(r):a.set(r,i=[]),i.push(n);return m(a)}(this.appSegments,"type");this.mergedAppSegments=t.map((function(t){var n=t[0],r=t[1],i=W.get(n,e.options);return i.handleMultiSegments?{type:n,chunk:i.handleMultiSegments(r)}:r[0]}));}}},{key:"getSegment",value:function(e){return this.appSegments.find((function(t){return t.type===e}))}},{key:"getOrFindSegment",value:function(e){try{var t=this,n=t.getSegment(e);return Ke((function(){if(void 0===n)return Re(t.findAppSegments(0,[e]),(function(){n=t.getSegment(e);}))}),(function(){return n}))}catch(e){return Promise.reject(e)}}}],[{key:"canHandle",value:function(e,t){return 65496===t}}]),s}(Ee);function $e(){}i(Ze,"type","jpeg"),M.set("jpeg",Ze);function et(e,t){if(!t)return e&&e.then?e.then($e):Promise.resolve()}function tt(e,t){var n=e();return n&&n.then?n.then(t):t(n)}var nt=[void 0,1,1,2,4,8,1,1,2,4,8,4,8,4];var rt=function(e){a(i,e);var n=d(i);function i(){return t(this,i),n.apply(this,arguments)}return r(i,[{key:"parse",value:function(){try{var e=this;e.parseHeader();var t=e.options;return tt((function(){if(t.ifd0.enabled)return et(e.parseIfd0Block())}),(function(){return tt((function(){if(t.exif.enabled)return et(e.safeParse("parseExifBlock"))}),(function(){return tt((function(){if(t.gps.enabled)return et(e.safeParse("parseGpsBlock"))}),(function(){return tt((function(){if(t.interop.enabled)return et(e.safeParse("parseInteropBlock"))}),(function(){return tt((function(){if(t.ifd1.enabled)return et(e.safeParse("parseThumbnailBlock"))}),(function(){return e.createOutput()}))}))}))}))}))}catch(e){return Promise.reject(e)}}},{key:"safeParse",value:function(e){var t=this[e]();return void 0!==t.catch&&(t=t.catch(this.handleError)),t}},{key:"findIfd0Offset",value:function(){void 0===this.ifd0Offset&&(this.ifd0Offset=this.chunk.getUint32(4));}},{key:"findIfd1Offset",value:function(){if(void 0===this.ifd1Offset){this.findIfd0Offset();var e=this.chunk.getUint16(this.ifd0Offset),t=this.ifd0Offset+2+12*e;this.ifd1Offset=this.chunk.getUint32(t);}}},{key:"parseBlock",value:function(e,t){var n=S();return this[t]=n,this.parseTags(e,t,n),n}},{key:"parseIfd0Block",value:function(){try{var e=this;if(e.ifd0)return;var t=e.file;return e.findIfd0Offset(),e.ifd0Offset<8&&L("Malformed EXIF data"),!t.chunked&&e.ifd0Offset>t.byteLength&&L("IFD0 offset points to outside of file.\nthis.ifd0Offset: ".concat(e.ifd0Offset,", file.byteLength: ").concat(t.byteLength)),tt((function(){if(t.tiff)return et(t.ensureChunk(e.ifd0Offset,T(e.options)))}),(function(){var t=e.parseBlock(e.ifd0Offset,"ifd0");if(0!==t.size)return e.exifOffset=t.get(ce),e.interopOffset=t.get(le),e.gpsOffset=t.get(he),e.xmp=t.get(700),e.iptc=t.get(oe),e.icc=t.get(fe),e.options.sanitize&&(t.delete(ce),t.delete(le),t.delete(he),t.delete(700),t.delete(oe),t.delete(fe)),t}))}catch(e){return Promise.reject(e)}}},{key:"parseExifBlock",value:function(){try{var e=this;if(e.exif)return;return tt((function(){if(!e.ifd0)return et(e.parseIfd0Block())}),(function(){if(void 0!==e.exifOffset)return tt((function(){if(e.file.tiff)return et(e.file.ensureChunk(e.exifOffset,T(e.options)))}),(function(){var t=e.parseBlock(e.exifOffset,"exif");return e.interopOffset||(e.interopOffset=t.get(le)),e.makerNote=t.get(se),e.userComment=t.get(ue),e.options.sanitize&&(t.delete(le),t.delete(se),t.delete(ue)),e.unpack(t,41728),e.unpack(t,41729),t}))}))}catch(e){return Promise.reject(e)}}},{key:"unpack",value:function(e,t){var n=e.get(t);n&&1===n.length&&e.set(t,n[0]);}},{key:"parseGpsBlock",value:function(){try{var e=this;if(e.gps)return;return tt((function(){if(!e.ifd0)return et(e.parseIfd0Block())}),(function(){if(void 0!==e.gpsOffset){var t=e.parseBlock(e.gpsOffset,"gps");return t&&t.has(2)&&t.has(4)&&(t.set("latitude",it.apply(void 0,t.get(2).concat([t.get(1)]))),t.set("longitude",it.apply(void 0,t.get(4).concat([t.get(3)])))),t}}))}catch(e){return Promise.reject(e)}}},{key:"parseInteropBlock",value:function(){try{var e=this;if(e.interop)return;return tt((function(){if(!e.ifd0)return et(e.parseIfd0Block())}),(function(){return tt((function(){if(void 0===e.interopOffset&&!e.exif)return et(e.parseExifBlock())}),(function(){if(void 0!==e.interopOffset)return e.parseBlock(e.interopOffset,"interop")}))}))}catch(e){return Promise.reject(e)}}},{key:"parseThumbnailBlock",value:function(){var e=arguments.length>0&&void 0!==arguments[0]&&arguments[0];try{var t=this;if(t.ifd1||t.ifd1Parsed)return;if(t.options.mergeOutput&&!e)return;return t.findIfd1Offset(),t.ifd1Offset>0&&(t.parseBlock(t.ifd1Offset,"ifd1"),t.ifd1Parsed=!0),t.ifd1}catch(e){return Promise.reject(e)}}},{key:"extractThumbnail",value:function(){try{var e=this;return e.headerParsed||e.parseHeader(),tt((function(){if(!e.ifd1Parsed)return et(e.parseThumbnailBlock(!0))}),(function(){if(void 0!==e.ifd1){var t=e.ifd1.get(513),n=e.ifd1.get(514);return e.chunk.getUint8Array(t,n)}}))}catch(e){return Promise.reject(e)}}},{key:"image",get:function(){return this.ifd0}},{key:"thumbnail",get:function(){return this.ifd1}},{key:"createOutput",value:function(){var e,t,n,r={},i=ye;Array.isArray(i)||("function"==typeof i.entries&&(i=i.entries()),i=m(i));for(var a=0;a<i.length;a++)if(!I(e=this[t=i[a]]))if(n=this.canTranslate?this.translateBlock(e,t):k(e),this.options.mergeOutput){if("ifd1"===t)continue;g(r,n);}else r[t]=n;return this.makerNote&&(r.makerNote=this.makerNote),this.userComment&&(r.userComment=this.userComment),r}},{key:"assignToOutput",value:function(e,t){if(this.globalOptions.mergeOutput)g(e,t);else {var n=y(t);Array.isArray(n)||("function"==typeof n.entries&&(n=n.entries()),n=m(n));for(var r=0;r<n.length;r++){var i=n[r],a=i[0],s=i[1];this.assignObjectToOutput(e,a,s);}}}}],[{key:"canHandle",value:function(e,t){return 225===e.getUint8(t+1)&&1165519206===e.getUint32(t+4)&&0===e.getUint16(t+8)}}]),i}(function(e){a(i,e);var n=d(i);function i(){return t(this,i),n.apply(this,arguments)}return r(i,[{key:"parseHeader",value:function(){var e=this.chunk.getUint16();18761===e?this.le=!0:19789===e&&(this.le=!1),this.chunk.le=this.le,this.headerParsed=!0;}},{key:"parseTags",value:function(e,t){var n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:S(),r=this.options[t],i=r.pick,a=r.skip,s=(i=O(i)).size>0,u=0===a.size,o=this.chunk.getUint16(e);e+=2;for(var f=0;f<o;f++){var c=this.chunk.getUint16(e);if(s){if(i.has(c)&&(n.set(c,this.parseTag(e,c,t)),i.delete(c),0===i.size))break}else !u&&a.has(c)||n.set(c,this.parseTag(e,c,t));e+=12;}return n}},{key:"parseTag",value:function(e,t,n){var r,i=this.chunk,a=i.getUint16(e+2),s=i.getUint32(e+4),u=nt[a];if(u*s<=4?e+=8:e=i.getUint32(e+8),(a<1||a>13)&&L("Invalid TIFF value type. block: ".concat(n.toUpperCase(),", tag: ").concat(t.toString(16),", type: ").concat(a,", offset ").concat(e)),e>i.byteLength&&L("Invalid TIFF value offset. block: ".concat(n.toUpperCase(),", tag: ").concat(t.toString(16),", type: ").concat(a,", offset ").concat(e," is outside of chunk size ").concat(i.byteLength)),1===a)return i.getUint8Array(e,s);if(2===a)return ""===(r=function(e){for(;e.endsWith("\0");)e=e.slice(0,-1);return e}(r=i.getString(e,s)).trim())?void 0:r;if(7===a)return i.getUint8Array(e,s);if(1===s)return this.parseTagValue(a,e);for(var o=new(function(e){switch(e){case 1:return Uint8Array;case 3:return Uint16Array;case 4:return Uint32Array;case 5:return Array;case 6:return Int8Array;case 8:return Int16Array;case 9:return Int32Array;case 10:return Array;case 11:return Float32Array;case 12:return Float64Array;default:return Array}}(a))(s),f=u,c=0;c<s;c++)o[c]=this.parseTagValue(a,e),e+=f;return o}},{key:"parseTagValue",value:function(e,t){var n=this.chunk;switch(e){case 1:return n.getUint8(t);case 3:return n.getUint16(t);case 4:return n.getUint32(t);case 5:return n.getUint32(t)/n.getUint32(t+4);case 6:return n.getInt8(t);case 8:return n.getInt16(t);case 9:return n.getInt32(t);case 10:return n.getInt32(t)/n.getInt32(t+4);case 11:return n.getFloat(t);case 12:return n.getDouble(t);case 13:return n.getUint32(t);default:L("Invalid tiff type ".concat(e));}}}]),i}(De));function it(e,t,n,r){var i=e+t/60+n/3600;return "S"!==r&&"W"!==r||(i*=-1),i}i(rt,"type","tiff"),i(rt,"headerLength",10),W.set("tiff",rt);var at=Object.freeze({__proto__:null,default:ze,Exifr:Ie,fileParsers:M,segmentParsers:W,fileReaders:K,tagKeys:re,tagValues:ie,tagRevivers:ae,createDictionary:te,extendDictionary:ne,fetchUrlAsArrayBuffer:G,readBlobAsArrayBuffer:Y,chunkedProps:de,otherSegments:ve,segments:pe,tiffBlocks:ye,segmentsAndBlocks:ge,tiffExtractables:ke,inheritables:me,allFormatters:be,Options:Pe,parse:Te});function st(e,t,n){return n?t?t(e):e:(e&&e.then||(e=Promise.resolve(e)),t?e.then(t):e)}function ut(e){return function(){for(var t=[],n=0;n<arguments.length;n++)t[n]=arguments[n];try{return Promise.resolve(e.apply(this,t))}catch(e){return Promise.reject(e)}}}var ot=ut((function(e){var t=new Ie(vt);return st(t.read(e),(function(){return st(t.parse(),(function(e){if(e&&e.ifd0)return e.ifd0[274]}))}))})),ft=ut((function(e){var t=new Ie(dt);return st(t.read(e),(function(){return st(t.parse(),(function(e){if(e&&e.gps){var t=e.gps;return {latitude:t.latitude,longitude:t.longitude}}}))}))})),ct=ut((function(e){return st(this.thumbnail(e),(function(e){if(void 0!==e){var t=new Blob([e]);return URL.createObjectURL(t)}}))})),ht=ut((function(e){var t=new Ie(pt);return st(t.read(e),(function(){return st(t.extractThumbnail(),(function(e){return e&&_?j.from(e):e}))}))})),lt={ifd0:!1,ifd1:!1,exif:!1,gps:!1,interop:!1,sanitize:!1,reviveValues:!0,translateKeys:!1,translateValues:!1,mergeOutput:!1},dt=g({},lt,{firstChunkSize:4e4,gps:[1,2,3,4]}),vt=g({},lt,{firstChunkSize:4e4,ifd0:[274]}),pt=g({},lt,{tiff:!1,ifd1:!0,mergeOutput:!1}),yt=Object.freeze({1:{dimensionSwapped:!1,scaleX:1,scaleY:1,deg:0,rad:0},2:{dimensionSwapped:!1,scaleX:-1,scaleY:1,deg:0,rad:0},3:{dimensionSwapped:!1,scaleX:1,scaleY:1,deg:180,rad:180*Math.PI/180},4:{dimensionSwapped:!1,scaleX:-1,scaleY:1,deg:180,rad:180*Math.PI/180},5:{dimensionSwapped:!0,scaleX:1,scaleY:-1,deg:90,rad:90*Math.PI/180},6:{dimensionSwapped:!0,scaleX:1,scaleY:1,deg:90,rad:90*Math.PI/180},7:{dimensionSwapped:!0,scaleX:1,scaleY:-1,deg:270,rad:270*Math.PI/180},8:{dimensionSwapped:!0,scaleX:1,scaleY:1,deg:270,rad:270*Math.PI/180}});if(e.rotateCanvas=!0,e.rotateCss=!0,"object"==typeof navigator){var gt=navigator.userAgent;if(gt.includes("iPad")||gt.includes("iPhone")){var kt=gt.match(/OS (\d+)_(\d+)/);if(kt){var mt=kt[1],bt=kt[2],At=Number(mt)+.1*Number(bt);e.rotateCanvas=At<13.4,e.rotateCss=!1;}}else if(gt.includes("OS X 10")){var wt=gt.match(/OS X 10[_.](\d+)/)[1];e.rotateCanvas=e.rotateCss=Number(wt)<15;}if(gt.includes("Chrome/")){var Ot=gt.match(/Chrome\/(\d+)/)[1];e.rotateCanvas=e.rotateCss=Number(Ot)<81;}else if(gt.includes("Firefox/")){var St=gt.match(/Firefox\/(\d+)/)[1];e.rotateCanvas=e.rotateCss=Number(St)<77;}}function Pt(){}var Ut=function(e){a(u,e);var n=d(u);function u(){var e;t(this,u);for(var r=arguments.length,a=new Array(r),s=0;s<r;s++)a[s]=arguments[s];return i(h(e=n.call.apply(n,[this].concat(a))),"ranges",new xt),0!==e.byteLength&&e.ranges.add(0,e.byteLength),e}return r(u,[{key:"_tryExtend",value:function(e,t,n){if(0===e&&0===this.byteLength&&n){var r=new DataView(n.buffer||n,n.byteOffset,n.byteLength);this._swapDataView(r);}else {var i=e+t;if(i>this.byteLength){var a=this._extend(i).dataView;this._swapDataView(a);}}}},{key:"_extend",value:function(e){var t;t=_?j.allocUnsafe(e):new Uint8Array(e);var n=new DataView(t.buffer,t.byteOffset,t.byteLength);return t.set(new Uint8Array(this.buffer,this.byteOffset,this.byteLength),0),{uintView:t,dataView:n}}},{key:"subarray",value:function(e,t){var n=arguments.length>2&&void 0!==arguments[2]&&arguments[2];return t=t||this._lengthToEnd(e),n&&this._tryExtend(e,t),this.ranges.add(e,t),v(s(u.prototype),"subarray",this).call(this,e,t)}},{key:"set",value:function(e,t){var n=arguments.length>2&&void 0!==arguments[2]&&arguments[2];n&&this._tryExtend(t,e.byteLength,e);var r=v(s(u.prototype),"set",this).call(this,e,t);return this.ranges.add(t,r.byteLength),r}},{key:"ensureChunk",value:function(e,t){try{var n=this;if(!n.chunked)return;if(n.ranges.available(e,t))return;return function(e,t){if(!t)return e&&e.then?e.then(Pt):Promise.resolve()}(n.readChunk(e,t))}catch(e){return Promise.reject(e)}}},{key:"available",value:function(e,t){return this.ranges.available(e,t)}}]),u}(D),xt=function(){function e(){t(this,e),i(this,"list",[]);}return r(e,[{key:"length",get:function(){return this.list.length}},{key:"add",value:function(e,t){var n=e+t,r=this.list.filter((function(t){return Ct(e,t.offset,n)||Ct(e,t.end,n)}));if(r.length>0){e=Math.min.apply(Math,[e].concat(r.map((function(e){return e.offset})))),t=(n=Math.max.apply(Math,[n].concat(r.map((function(e){return e.end})))))-e;var i=r.shift();i.offset=e,i.length=t,i.end=n,this.list=this.list.filter((function(e){return !r.includes(e)}));}else this.list.push({offset:e,length:t,end:n});}},{key:"available",value:function(e,t){var n=e+t;return this.list.some((function(t){return t.offset<=e&&n<=t.end}))}}]),e}();function Ct(e,t,n){return e<=t&&t<=n}function Bt(){}function jt(e,t){if(!t)return e&&e.then?e.then(Bt):Promise.resolve()}function _t(e,t,n){return n?t?t(e):e:(e&&e.then||(e=Promise.resolve(e)),t?e.then(t):e)}var Vt=function(e){a(i,e);var n=d(i);function i(){return t(this,i),n.apply(this,arguments)}return r(i,[{key:"readWhole",value:function(){try{var e=this;return e.chunked=!1,_t(Y(e.input),(function(t){e._swapArrayBuffer(t);}))}catch(e){return Promise.reject(e)}}},{key:"readChunked",value:function(){return this.chunked=!0,this.size=this.input.size,v(s(i.prototype),"readChunked",this).call(this)}},{key:"_readChunk",value:function(e,t){try{var n=this,r=t?e+t:void 0,i=n.input.slice(e,r);return _t(Y(i),(function(t){return n.set(t,e,!0)}))}catch(e){return Promise.reject(e)}}}]),i}(function(e){a(s,e);var n=d(s);function s(e,r){var a;return t(this,s),i(h(a=n.call(this,0)),"chunksRead",0),a.input=e,a.options=r,a}return r(s,[{key:"readWhole",value:function(){try{var e=this;return e.chunked=!1,jt(e.readChunk(e.nextChunkOffset))}catch(e){return Promise.reject(e)}}},{key:"readChunked",value:function(){try{var e=this;return e.chunked=!0,jt(e.readChunk(0,e.options.firstChunkSize))}catch(e){return Promise.reject(e)}}},{key:"readNextChunk",value:function(e){try{var t=this;if(void 0===e&&(e=t.nextChunkOffset),t.fullyRead)return t.chunksRead++,!1;var n=t.options.chunkSize;return r=t.readChunk(e,n),i=function(e){return !!e&&e.byteLength===n},a?i?i(r):r:(r&&r.then||(r=Promise.resolve(r)),i?r.then(i):r)}catch(e){return Promise.reject(e)}var r,i,a;}},{key:"readChunk",value:function(e,t){try{var n=this;if(n.chunksRead++,0===(t=n.safeWrapAddress(e,t)))return;return n._readChunk(e,t)}catch(e){return Promise.reject(e)}}},{key:"safeWrapAddress",value:function(e,t){return void 0!==this.size&&e+t>this.size?Math.max(0,this.size-e):t}},{key:"nextChunkOffset",get:function(){if(0!==this.ranges.list.length)return this.ranges.list[0].length}},{key:"canReadNextChunk",get:function(){return this.chunksRead<this.options.chunkLimit}},{key:"fullyRead",get:function(){return void 0!==this.size&&this.nextChunkOffset===this.size}},{key:"read",value:function(){return this.options.chunked?this.readChunked():this.readWhole()}},{key:"close",value:function(){}}]),s}(Ut));K.set("blob",Vt),e.Exifr=Ie,e.Options=Pe,e.allFormatters=be,e.chunkedProps=de,e.createDictionary=te,e.default=at,e.disableAllOptions=lt,e.extendDictionary=ne,e.fetchUrlAsArrayBuffer=G,e.fileParsers=M,e.fileReaders=K,e.gps=ft,e.gpsOnlyOptions=dt,e.inheritables=me,e.orientation=ot,e.orientationOnlyOptions=vt,e.otherSegments=ve,e.parse=Te,e.readBlobAsArrayBuffer=Y,e.rotation=function(t){return st(ot(t),(function(t){return g({canvas:e.rotateCanvas,css:e.rotateCss},yt[t])}))},e.rotations=yt,e.segmentParsers=W,e.segments=pe,e.segmentsAndBlocks=ge,e.tagKeys=re,e.tagRevivers=ae,e.tagValues=ie,e.thumbnail=ht,e.thumbnailOnlyOptions=pt,e.thumbnailUrl=ct,e.tiffBlocks=ye,e.tiffExtractables=ke,Object.defineProperty(e,"__esModule",{value:!0});}));
    });

    var _class$2, _temp$2;

    function _extends$b() { _extends$b = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$b.apply(this, arguments); }

    function _inheritsLoose$8(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; _setPrototypeOf$8(subClass, superClass); }

    function _setPrototypeOf$8(o, p) { _setPrototypeOf$8 = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$8(o, p); }

    var Plugin$3 = lib$1.Plugin;









     // Polyfill for IE.



    /**
     * The Thumbnail Generator plugin
     */


    var lib$4 = (_temp$2 = _class$2 = /*#__PURE__*/function (_Plugin) {
      _inheritsLoose$8(ThumbnailGenerator, _Plugin);

      function ThumbnailGenerator(uppy, opts) {
        var _this;

        _this = _Plugin.call(this, uppy, opts) || this;

        _this.onFileAdded = function (file) {
          if (!file.preview && isPreviewSupported(file.type) && !file.isRemote) {
            _this.addToQueue(file.id);
          }
        };

        _this.onCancelRequest = function (file) {
          var index = _this.queue.indexOf(file.id);

          if (index !== -1) {
            _this.queue.splice(index, 1);
          }
        };

        _this.onFileRemoved = function (file) {
          var index = _this.queue.indexOf(file.id);

          if (index !== -1) {
            _this.queue.splice(index, 1);
          } // Clean up object URLs.


          if (file.preview && isObjectURL(file.preview)) {
            URL.revokeObjectURL(file.preview);
          }
        };

        _this.onRestored = function () {
          var _this$uppy$getState = _this.uppy.getState(),
              files = _this$uppy$getState.files;

          var fileIDs = Object.keys(files);
          fileIDs.forEach(function (fileID) {
            var file = _this.uppy.getFile(fileID);

            if (!file.isRestored) return; // Only add blob URLs; they are likely invalid after being restored.

            if (!file.preview || isObjectURL(file.preview)) {
              _this.addToQueue(file.id);
            }
          });
        };

        _this.waitUntilAllProcessed = function (fileIDs) {
          fileIDs.forEach(function (fileID) {
            var file = _this.uppy.getFile(fileID);

            _this.uppy.emit('preprocess-progress', file, {
              mode: 'indeterminate',
              message: _this.i18n('generatingThumbnails')
            });
          });

          var emitPreprocessCompleteForAll = function emitPreprocessCompleteForAll() {
            fileIDs.forEach(function (fileID) {
              var file = _this.uppy.getFile(fileID);

              _this.uppy.emit('preprocess-complete', file);
            });
          };

          return new Promise(function (resolve, reject) {
            if (_this.queueProcessing) {
              _this.uppy.once('thumbnail:all-generated', function () {
                emitPreprocessCompleteForAll();
                resolve();
              });
            } else {
              emitPreprocessCompleteForAll();
              resolve();
            }
          });
        };

        _this.type = 'modifier';
        _this.id = _this.opts.id || 'ThumbnailGenerator';
        _this.title = 'Thumbnail Generator';
        _this.queue = [];
        _this.queueProcessing = false;
        _this.defaultThumbnailDimension = 200;
        _this.thumbnailType = _this.opts.thumbnailType || 'image/jpeg';
        _this.defaultLocale = {
          strings: {
            generatingThumbnails: 'Generating thumbnails...'
          }
        };
        var defaultOptions = {
          thumbnailWidth: null,
          thumbnailHeight: null,
          waitForThumbnailsBeforeUpload: false,
          lazy: false
        };
        _this.opts = _extends$b({}, defaultOptions, opts);

        if (_this.opts.lazy && _this.opts.waitForThumbnailsBeforeUpload) {
          throw new Error('ThumbnailGenerator: The `lazy` and `waitForThumbnailsBeforeUpload` options are mutually exclusive. Please ensure at most one of them is set to `true`.');
        }

        _this.i18nInit();

        return _this;
      }

      var _proto = ThumbnailGenerator.prototype;

      _proto.setOptions = function setOptions(newOpts) {
        _Plugin.prototype.setOptions.call(this, newOpts);

        this.i18nInit();
      };

      _proto.i18nInit = function i18nInit() {
        this.translator = new Translator([this.defaultLocale, this.uppy.locale, this.opts.locale]);
        this.i18n = this.translator.translate.bind(this.translator);
        this.setPluginState(); // so that UI re-renders and we see the updated locale
      }
      /**
       * Create a thumbnail for the given Uppy file object.
       *
       * @param {{data: Blob}} file
       * @param {number} targetWidth
       * @param {number} targetHeight
       * @returns {Promise}
       */
      ;

      _proto.createThumbnail = function createThumbnail(file, targetWidth, targetHeight) {
        var _this2 = this;

        // bug in the compatibility data
        // eslint-disable-next-line compat/compat
        var originalUrl = URL.createObjectURL(file.data);
        var onload = new Promise(function (resolve, reject) {
          var image = new Image();
          image.src = originalUrl;
          image.addEventListener('load', function () {
            // bug in the compatibility data
            // eslint-disable-next-line compat/compat
            URL.revokeObjectURL(originalUrl);
            resolve(image);
          });
          image.addEventListener('error', function (event) {
            // bug in the compatibility data
            // eslint-disable-next-line compat/compat
            URL.revokeObjectURL(originalUrl);
            reject(event.error || new Error('Could not create thumbnail'));
          });
        });
        var orientationPromise = mini_legacy_umd.rotation(file.data).catch(function (_err) {
          return 1;
        });
        return Promise.all([onload, orientationPromise]).then(function (_ref) {
          var image = _ref[0],
              orientation = _ref[1];

          var dimensions = _this2.getProportionalDimensions(image, targetWidth, targetHeight, orientation.deg);

          var rotatedImage = _this2.rotateImage(image, orientation);

          var resizedImage = _this2.resizeImage(rotatedImage, dimensions.width, dimensions.height);

          return _this2.canvasToBlob(resizedImage, _this2.thumbnailType, 80);
        }).then(function (blob) {
          // bug in the compatibility data
          // eslint-disable-next-line compat/compat
          return URL.createObjectURL(blob);
        });
      }
      /**
       * Get the new calculated dimensions for the given image and a target width
       * or height. If both width and height are given, only width is taken into
       * account. If neither width nor height are given, the default dimension
       * is used.
       */
      ;

      _proto.getProportionalDimensions = function getProportionalDimensions(img, width, height, rotation) {
        var aspect = img.width / img.height;

        if (rotation === 90 || rotation === 270) {
          aspect = img.height / img.width;
        }

        if (width != null) {
          return {
            width: width,
            height: Math.round(width / aspect)
          };
        }

        if (height != null) {
          return {
            width: Math.round(height * aspect),
            height: height
          };
        }

        return {
          width: this.defaultThumbnailDimension,
          height: Math.round(this.defaultThumbnailDimension / aspect)
        };
      }
      /**
       * Make sure the image doesn’t exceed browser/device canvas limits.
       * For ios with 256 RAM and ie
       */
      ;

      _proto.protect = function protect(image) {
        // https://stackoverflow.com/questions/6081483/maximum-size-of-a-canvas-element
        var ratio = image.width / image.height;
        var maxSquare = 5000000; // ios max canvas square

        var maxSize = 4096; // ie max canvas dimensions

        var maxW = Math.floor(Math.sqrt(maxSquare * ratio));
        var maxH = Math.floor(maxSquare / Math.sqrt(maxSquare * ratio));

        if (maxW > maxSize) {
          maxW = maxSize;
          maxH = Math.round(maxW / ratio);
        }

        if (maxH > maxSize) {
          maxH = maxSize;
          maxW = Math.round(ratio * maxH);
        }

        if (image.width > maxW) {
          var canvas = document.createElement('canvas');
          canvas.width = maxW;
          canvas.height = maxH;
          canvas.getContext('2d').drawImage(image, 0, 0, maxW, maxH);
          image = canvas;
        }

        return image;
      }
      /**
       * Resize an image to the target `width` and `height`.
       *
       * Returns a Canvas with the resized image on it.
       */
      ;

      _proto.resizeImage = function resizeImage(image, targetWidth, targetHeight) {
        // Resizing in steps refactored to use a solution from
        // https://blog.uploadcare.com/image-resize-in-browsers-is-broken-e38eed08df01
        image = this.protect(image);
        var steps = Math.ceil(mathLog2(image.width / targetWidth));

        if (steps < 1) {
          steps = 1;
        }

        var sW = targetWidth * Math.pow(2, steps - 1);
        var sH = targetHeight * Math.pow(2, steps - 1);
        var x = 2;

        while (steps--) {
          var canvas = document.createElement('canvas');
          canvas.width = sW;
          canvas.height = sH;
          canvas.getContext('2d').drawImage(image, 0, 0, sW, sH);
          image = canvas;
          sW = Math.round(sW / x);
          sH = Math.round(sH / x);
        }

        return image;
      };

      _proto.rotateImage = function rotateImage(image, translate) {
        var w = image.width;
        var h = image.height;

        if (translate.deg === 90 || translate.deg === 270) {
          w = image.height;
          h = image.width;
        }

        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var context = canvas.getContext('2d');
        context.translate(w / 2, h / 2);

        if (translate.canvas) {
          context.rotate(translate.rad);
          context.scale(translate.scaleX, translate.scaleY);
        }

        context.drawImage(image, -image.width / 2, -image.height / 2, image.width, image.height);
        return canvas;
      }
      /**
       * Save a <canvas> element's content to a Blob object.
       *
       * @param {HTMLCanvasElement} canvas
       * @returns {Promise}
       */
      ;

      _proto.canvasToBlob = function canvasToBlob(canvas, type, quality) {
        try {
          canvas.getContext('2d').getImageData(0, 0, 1, 1);
        } catch (err) {
          if (err.code === 18) {
            return Promise.reject(new Error('cannot read image, probably an svg with external resources'));
          }
        }

        if (canvas.toBlob) {
          return new Promise(function (resolve) {
            canvas.toBlob(resolve, type, quality);
          }).then(function (blob) {
            if (blob === null) {
              throw new Error('cannot read image, probably an svg with external resources');
            }

            return blob;
          });
        }

        return Promise.resolve().then(function () {
          return dataURItoBlob(canvas.toDataURL(type, quality), {});
        }).then(function (blob) {
          if (blob === null) {
            throw new Error('could not extract blob, probably an old browser');
          }

          return blob;
        });
      }
      /**
       * Set the preview URL for a file.
       */
      ;

      _proto.setPreviewURL = function setPreviewURL(fileID, preview) {
        this.uppy.setFileState(fileID, {
          preview: preview
        });
      };

      _proto.addToQueue = function addToQueue(item) {
        this.queue.push(item);

        if (this.queueProcessing === false) {
          this.processQueue();
        }
      };

      _proto.processQueue = function processQueue() {
        var _this3 = this;

        this.queueProcessing = true;

        if (this.queue.length > 0) {
          var current = this.uppy.getFile(this.queue.shift());

          if (!current) {
            this.uppy.log('[ThumbnailGenerator] file was removed before a thumbnail could be generated, but not removed from the queue. This is probably a bug', 'error');
            return;
          }

          return this.requestThumbnail(current).catch(function (err) {}) // eslint-disable-line handle-callback-err
          .then(function () {
            return _this3.processQueue();
          });
        }

        this.queueProcessing = false;
        this.uppy.log('[ThumbnailGenerator] Emptied thumbnail queue');
        this.uppy.emit('thumbnail:all-generated');
      };

      _proto.requestThumbnail = function requestThumbnail(file) {
        var _this4 = this;

        if (isPreviewSupported(file.type) && !file.isRemote) {
          return this.createThumbnail(file, this.opts.thumbnailWidth, this.opts.thumbnailHeight).then(function (preview) {
            _this4.setPreviewURL(file.id, preview);

            _this4.uppy.log("[ThumbnailGenerator] Generated thumbnail for " + file.id);

            _this4.uppy.emit('thumbnail:generated', _this4.uppy.getFile(file.id), preview);
          }).catch(function (err) {
            _this4.uppy.log("[ThumbnailGenerator] Failed thumbnail for " + file.id + ":", 'warning');

            _this4.uppy.log(err, 'warning');

            _this4.uppy.emit('thumbnail:error', _this4.uppy.getFile(file.id), err);
          });
        }

        return Promise.resolve();
      };

      _proto.install = function install() {
        this.uppy.on('file-removed', this.onFileRemoved);

        if (this.opts.lazy) {
          this.uppy.on('thumbnail:request', this.onFileAdded);
          this.uppy.on('thumbnail:cancel', this.onCancelRequest);
        } else {
          this.uppy.on('file-added', this.onFileAdded);
          this.uppy.on('restored', this.onRestored);
        }

        if (this.opts.waitForThumbnailsBeforeUpload) {
          this.uppy.addPreProcessor(this.waitUntilAllProcessed);
        }
      };

      _proto.uninstall = function uninstall() {
        this.uppy.off('file-removed', this.onFileRemoved);

        if (this.opts.lazy) {
          this.uppy.off('thumbnail:request', this.onFileAdded);
          this.uppy.off('thumbnail:cancel', this.onCancelRequest);
        } else {
          this.uppy.off('file-added', this.onFileAdded);
          this.uppy.off('restored', this.onRestored);
        }

        if (this.opts.waitForThumbnailsBeforeUpload) {
          this.uppy.removePreProcessor(this.waitUntilAllProcessed);
        }
      };

      return ThumbnailGenerator;
    }(Plugin$3), _class$2.VERSION = "1.7.8", _temp$2);

    /**
     * Find one or more DOM elements.
     *
     * @param {string} element
     * @returns {Array|null}
     */


    var findAllDOMElements = function findAllDOMElements(element) {
      if (typeof element === 'string') {
        var elements = [].slice.call(document.querySelectorAll(element));
        return elements.length > 0 ? elements : null;
      }

      if (typeof element === 'object' && isDOMElement(element)) {
        return [element];
      }
    };

    /**
     * Converts list into array
     */
    var toArray = function toArray(list) {
      return Array.prototype.slice.call(list || [], 0);
    };

    /**
     * Get the relative path from the FileEntry#fullPath, because File#webkitRelativePath is always '', at least onDrop.
     *
     * @param {FileEntry} fileEntry
     *
     * @returns {string|null} - if file is not in a folder - return null (this is to be consistent with .relativePath-s of files selected from My Device). If file is in a folder - return its fullPath, e.g. '/simpsons/hi.jpeg'.
     */
    var getRelativePath = function getRelativePath(fileEntry) {
      // fileEntry.fullPath - "/simpsons/hi.jpeg" or undefined (for browsers that don't support it)
      // fileEntry.name - "hi.jpeg"
      if (!fileEntry.fullPath || fileEntry.fullPath === "/" + fileEntry.name) {
        return null;
      }

      return fileEntry.fullPath;
    };

    /**
     * Recursive function, calls the original callback() when the directory is entirely parsed.
     *
     * @param {FileSystemDirectoryReader} directoryReader
     * @param {Array} oldEntries
     * @param {Function} logDropError
     * @param {Function} callback - called with ([ all files and directories in that directoryReader ])
     */
    var getFilesAndDirectoriesFromDirectory = function getFilesAndDirectoriesFromDirectory(directoryReader, oldEntries, logDropError, _ref) {
      var onSuccess = _ref.onSuccess;
      directoryReader.readEntries(function (entries) {
        var newEntries = [].concat(oldEntries, entries); // According to the FileSystem API spec, getFilesAndDirectoriesFromDirectory() must be called until it calls the onSuccess with an empty array.

        if (entries.length) {
          setTimeout(function () {
            getFilesAndDirectoriesFromDirectory(directoryReader, newEntries, logDropError, {
              onSuccess: onSuccess
            });
          }, 0); // Done iterating this particular directory
        } else {
          onSuccess(newEntries);
        }
      }, // Make sure we resolve on error anyway, it's fine if only one directory couldn't be parsed!
      function (error) {
        logDropError(error);
        onSuccess(oldEntries);
      });
    };

    var webkitGetAsEntryApi = function webkitGetAsEntryApi(dataTransfer, logDropError) {
      var files = [];
      var rootPromises = [];
      /**
       * Returns a resolved promise, when :files array is enhanced
       *
       * @param {(FileSystemFileEntry|FileSystemDirectoryEntry)} entry
       * @returns {Promise} - empty promise that resolves when :files is enhanced with a file
       */

      var createPromiseToAddFileOrParseDirectory = function createPromiseToAddFileOrParseDirectory(entry) {
        return new Promise(function (resolve) {
          // This is a base call
          if (entry.isFile) {
            // Creates a new File object which can be used to read the file.
            entry.file(function (file) {
              file.relativePath = getRelativePath(entry);
              files.push(file);
              resolve();
            }, // Make sure we resolve on error anyway, it's fine if only one file couldn't be read!
            function (error) {
              logDropError(error);
              resolve();
            }); // This is a recursive call
          } else if (entry.isDirectory) {
            var directoryReader = entry.createReader();
            getFilesAndDirectoriesFromDirectory(directoryReader, [], logDropError, {
              onSuccess: function onSuccess(entries) {
                var promises = entries.map(function (entry) {
                  return createPromiseToAddFileOrParseDirectory(entry);
                });
                Promise.all(promises).then(function () {
                  return resolve();
                });
              }
            });
          }
        });
      }; // For each dropped item, - make sure it's a file/directory, and start deepening in!


      toArray(dataTransfer.items).forEach(function (item) {
        var entry = item.webkitGetAsEntry(); // :entry can be null when we drop the url e.g.

        if (entry) {
          rootPromises.push(createPromiseToAddFileOrParseDirectory(entry));
        }
      });
      return Promise.all(rootPromises).then(function () {
        return files;
      });
    };

    // .files fallback, should be implemented in any browser


    var fallbackApi = function fallbackApi(dataTransfer) {
      var files = toArray(dataTransfer.files);
      return Promise.resolve(files);
    };

    /**
     * Returns a promise that resolves to the array of dropped files (if a folder is dropped, and browser supports folder parsing - promise resolves to the flat array of all files in all directories).
     * Each file has .relativePath prop appended to it (e.g. "/docs/Prague/ticket_from_prague_to_ufa.pdf") if browser supports it. Otherwise it's undefined.
     *
     * @param {DataTransfer} dataTransfer
     * @param {Function} logDropError - a function that's called every time some folder or some file error out (e.g. because of the folder name being too long on Windows). Notice that resulting promise will always be resolved anyway.
     *
     * @returns {Promise} - Array<File>
     */


    var getDroppedFiles = function getDroppedFiles(dataTransfer, _temp) {
      var _ref = _temp === void 0 ? {} : _temp,
          _ref$logDropError = _ref.logDropError,
          logDropError = _ref$logDropError === void 0 ? function () {} : _ref$logDropError;

      // Get all files from all subdirs. Works (at least) in Chrome, Mozilla, and Safari
      if (dataTransfer.items && dataTransfer.items[0] && 'webkitGetAsEntry' in dataTransfer.items[0]) {
        return webkitGetAsEntryApi(dataTransfer, logDropError); // Otherwise just return all first-order files
      }

      return fallbackApi(dataTransfer);
    };

    /**
     * @returns {HTMLElement} - either dashboard element, or the overlay that's most on top
     */
    var getActiveOverlayEl = function getActiveOverlayEl(dashboardEl, activeOverlayType) {
      if (activeOverlayType) {
        var overlayEl = dashboardEl.querySelector("[data-uppy-paneltype=\"" + activeOverlayType + "\"]"); // if an overlay is already mounted

        if (overlayEl) return overlayEl;
      }

      return dashboardEl;
    };

    var FOCUSABLE_ELEMENTS = ['a[href]:not([tabindex^="-"]):not([inert]):not([aria-hidden])', 'area[href]:not([tabindex^="-"]):not([inert]):not([aria-hidden])', 'input:not([disabled]):not([inert]):not([aria-hidden])', 'select:not([disabled]):not([inert]):not([aria-hidden])', 'textarea:not([disabled]):not([inert]):not([aria-hidden])', 'button:not([disabled]):not([inert]):not([aria-hidden])', 'iframe:not([tabindex^="-"]):not([inert]):not([aria-hidden])', 'object:not([tabindex^="-"]):not([inert]):not([aria-hidden])', 'embed:not([tabindex^="-"]):not([inert]):not([aria-hidden])', '[contenteditable]:not([tabindex^="-"]):not([inert]):not([aria-hidden])', '[tabindex]:not([tabindex^="-"]):not([inert]):not([aria-hidden])'];

    function focusOnFirstNode(event, nodes) {
      var node = nodes[0];

      if (node) {
        node.focus();
        event.preventDefault();
      }
    }

    function focusOnLastNode(event, nodes) {
      var node = nodes[nodes.length - 1];

      if (node) {
        node.focus();
        event.preventDefault();
      }
    } // ___Why not just use (focusedItemIndex === -1)?
    //    Firefox thinks <ul> is focusable, but we don't have <ul>s in our FOCUSABLE_ELEMENTS. Which means that if we tab into the <ul>, code will think that we are not in the active overlay, and we should focusOnFirstNode() of the currently active overlay!
    //    [Practical check] if we use (focusedItemIndex === -1), instagram provider in firefox will never get focus on its pics in the <ul>.


    function isFocusInOverlay(activeOverlayEl) {
      return activeOverlayEl.contains(document.activeElement);
    }

    function trapFocus(event, activeOverlayType, dashboardEl) {
      var activeOverlayEl = getActiveOverlayEl(dashboardEl, activeOverlayType);
      var focusableNodes = toArray(activeOverlayEl.querySelectorAll(FOCUSABLE_ELEMENTS));
      var focusedItemIndex = focusableNodes.indexOf(document.activeElement); // If we pressed tab, and focus is not yet within the current overlay - focus on the first element within the current overlay.
      // This is a safety measure (for when user returns from another tab e.g.), most plugins will try to focus on some important element as it loads.

      if (!isFocusInOverlay(activeOverlayEl)) {
        focusOnFirstNode(event, focusableNodes); // If we pressed shift + tab, and we're on the first element of a modal
      } else if (event.shiftKey && focusedItemIndex === 0) {
        focusOnLastNode(event, focusableNodes); // If we pressed tab, and we're on the last element of the modal
      } else if (!event.shiftKey && focusedItemIndex === focusableNodes.length - 1) {
        focusOnFirstNode(event, focusableNodes);
      }
    }

    var trapFocus_1 = {
      // Traps focus inside of the currently open overlay (e.g. Dashboard, or e.g. Instagram), never lets focus disappear from the modal.
      forModal: function forModal(event, activeOverlayType, dashboardEl) {
        trapFocus(event, activeOverlayType, dashboardEl);
      },
      // Traps focus inside of the currently open overlay, unless overlay is null - then let the user tab away.
      forInline: function forInline(event, activeOverlayType, dashboardEl) {
        // ___When we're in the bare 'Drop files here, paste, browse or import from' screen
        if (activeOverlayType === null) ; else {
          // Trap the focus inside this overlay!
          // User can close the overlay (click 'Done') if they want to travel away from Uppy.
          trapFocus(event, activeOverlayType, dashboardEl);
        }
      }
    };

    /**
     * A collection of shims that provide minimal functionality of the ES6 collections.
     *
     * These implementations are not meant to be used outside of the ResizeObserver
     * modules as they cover only a limited range of use cases.
     */
    /* eslint-disable require-jsdoc, valid-jsdoc */
    var MapShim = (function () {
        if (typeof Map !== 'undefined') {
            return Map;
        }
        /**
         * Returns index in provided array that matches the specified key.
         *
         * @param {Array<Array>} arr
         * @param {*} key
         * @returns {number}
         */
        function getIndex(arr, key) {
            var result = -1;
            arr.some(function (entry, index) {
                if (entry[0] === key) {
                    result = index;
                    return true;
                }
                return false;
            });
            return result;
        }
        return /** @class */ (function () {
            function class_1() {
                this.__entries__ = [];
            }
            Object.defineProperty(class_1.prototype, "size", {
                /**
                 * @returns {boolean}
                 */
                get: function () {
                    return this.__entries__.length;
                },
                enumerable: true,
                configurable: true
            });
            /**
             * @param {*} key
             * @returns {*}
             */
            class_1.prototype.get = function (key) {
                var index = getIndex(this.__entries__, key);
                var entry = this.__entries__[index];
                return entry && entry[1];
            };
            /**
             * @param {*} key
             * @param {*} value
             * @returns {void}
             */
            class_1.prototype.set = function (key, value) {
                var index = getIndex(this.__entries__, key);
                if (~index) {
                    this.__entries__[index][1] = value;
                }
                else {
                    this.__entries__.push([key, value]);
                }
            };
            /**
             * @param {*} key
             * @returns {void}
             */
            class_1.prototype.delete = function (key) {
                var entries = this.__entries__;
                var index = getIndex(entries, key);
                if (~index) {
                    entries.splice(index, 1);
                }
            };
            /**
             * @param {*} key
             * @returns {void}
             */
            class_1.prototype.has = function (key) {
                return !!~getIndex(this.__entries__, key);
            };
            /**
             * @returns {void}
             */
            class_1.prototype.clear = function () {
                this.__entries__.splice(0);
            };
            /**
             * @param {Function} callback
             * @param {*} [ctx=null]
             * @returns {void}
             */
            class_1.prototype.forEach = function (callback, ctx) {
                if (ctx === void 0) { ctx = null; }
                for (var _i = 0, _a = this.__entries__; _i < _a.length; _i++) {
                    var entry = _a[_i];
                    callback.call(ctx, entry[1], entry[0]);
                }
            };
            return class_1;
        }());
    })();

    /**
     * Detects whether window and document objects are available in current environment.
     */
    var isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined' && window.document === document;

    // Returns global object of a current environment.
    var global$1 = (function () {
        if (typeof global !== 'undefined' && global.Math === Math) {
            return global;
        }
        if (typeof self !== 'undefined' && self.Math === Math) {
            return self;
        }
        if (typeof window !== 'undefined' && window.Math === Math) {
            return window;
        }
        // eslint-disable-next-line no-new-func
        return Function('return this')();
    })();

    /**
     * A shim for the requestAnimationFrame which falls back to the setTimeout if
     * first one is not supported.
     *
     * @returns {number} Requests' identifier.
     */
    var requestAnimationFrame$1 = (function () {
        if (typeof requestAnimationFrame === 'function') {
            // It's required to use a bounded function because IE sometimes throws
            // an "Invalid calling object" error if rAF is invoked without the global
            // object on the left hand side.
            return requestAnimationFrame.bind(global$1);
        }
        return function (callback) { return setTimeout(function () { return callback(Date.now()); }, 1000 / 60); };
    })();

    // Defines minimum timeout before adding a trailing call.
    var trailingTimeout = 2;
    /**
     * Creates a wrapper function which ensures that provided callback will be
     * invoked only once during the specified delay period.
     *
     * @param {Function} callback - Function to be invoked after the delay period.
     * @param {number} delay - Delay after which to invoke callback.
     * @returns {Function}
     */
    function throttle$1 (callback, delay) {
        var leadingCall = false, trailingCall = false, lastCallTime = 0;
        /**
         * Invokes the original callback function and schedules new invocation if
         * the "proxy" was called during current request.
         *
         * @returns {void}
         */
        function resolvePending() {
            if (leadingCall) {
                leadingCall = false;
                callback();
            }
            if (trailingCall) {
                proxy();
            }
        }
        /**
         * Callback invoked after the specified delay. It will further postpone
         * invocation of the original function delegating it to the
         * requestAnimationFrame.
         *
         * @returns {void}
         */
        function timeoutCallback() {
            requestAnimationFrame$1(resolvePending);
        }
        /**
         * Schedules invocation of the original function.
         *
         * @returns {void}
         */
        function proxy() {
            var timeStamp = Date.now();
            if (leadingCall) {
                // Reject immediately following calls.
                if (timeStamp - lastCallTime < trailingTimeout) {
                    return;
                }
                // Schedule new call to be in invoked when the pending one is resolved.
                // This is important for "transitions" which never actually start
                // immediately so there is a chance that we might miss one if change
                // happens amids the pending invocation.
                trailingCall = true;
            }
            else {
                leadingCall = true;
                trailingCall = false;
                setTimeout(timeoutCallback, delay);
            }
            lastCallTime = timeStamp;
        }
        return proxy;
    }

    // Minimum delay before invoking the update of observers.
    var REFRESH_DELAY = 20;
    // A list of substrings of CSS properties used to find transition events that
    // might affect dimensions of observed elements.
    var transitionKeys = ['top', 'right', 'bottom', 'left', 'width', 'height', 'size', 'weight'];
    // Check if MutationObserver is available.
    var mutationObserverSupported = typeof MutationObserver !== 'undefined';
    /**
     * Singleton controller class which handles updates of ResizeObserver instances.
     */
    var ResizeObserverController = /** @class */ (function () {
        /**
         * Creates a new instance of ResizeObserverController.
         *
         * @private
         */
        function ResizeObserverController() {
            /**
             * Indicates whether DOM listeners have been added.
             *
             * @private {boolean}
             */
            this.connected_ = false;
            /**
             * Tells that controller has subscribed for Mutation Events.
             *
             * @private {boolean}
             */
            this.mutationEventsAdded_ = false;
            /**
             * Keeps reference to the instance of MutationObserver.
             *
             * @private {MutationObserver}
             */
            this.mutationsObserver_ = null;
            /**
             * A list of connected observers.
             *
             * @private {Array<ResizeObserverSPI>}
             */
            this.observers_ = [];
            this.onTransitionEnd_ = this.onTransitionEnd_.bind(this);
            this.refresh = throttle$1(this.refresh.bind(this), REFRESH_DELAY);
        }
        /**
         * Adds observer to observers list.
         *
         * @param {ResizeObserverSPI} observer - Observer to be added.
         * @returns {void}
         */
        ResizeObserverController.prototype.addObserver = function (observer) {
            if (!~this.observers_.indexOf(observer)) {
                this.observers_.push(observer);
            }
            // Add listeners if they haven't been added yet.
            if (!this.connected_) {
                this.connect_();
            }
        };
        /**
         * Removes observer from observers list.
         *
         * @param {ResizeObserverSPI} observer - Observer to be removed.
         * @returns {void}
         */
        ResizeObserverController.prototype.removeObserver = function (observer) {
            var observers = this.observers_;
            var index = observers.indexOf(observer);
            // Remove observer if it's present in registry.
            if (~index) {
                observers.splice(index, 1);
            }
            // Remove listeners if controller has no connected observers.
            if (!observers.length && this.connected_) {
                this.disconnect_();
            }
        };
        /**
         * Invokes the update of observers. It will continue running updates insofar
         * it detects changes.
         *
         * @returns {void}
         */
        ResizeObserverController.prototype.refresh = function () {
            var changesDetected = this.updateObservers_();
            // Continue running updates if changes have been detected as there might
            // be future ones caused by CSS transitions.
            if (changesDetected) {
                this.refresh();
            }
        };
        /**
         * Updates every observer from observers list and notifies them of queued
         * entries.
         *
         * @private
         * @returns {boolean} Returns "true" if any observer has detected changes in
         *      dimensions of it's elements.
         */
        ResizeObserverController.prototype.updateObservers_ = function () {
            // Collect observers that have active observations.
            var activeObservers = this.observers_.filter(function (observer) {
                return observer.gatherActive(), observer.hasActive();
            });
            // Deliver notifications in a separate cycle in order to avoid any
            // collisions between observers, e.g. when multiple instances of
            // ResizeObserver are tracking the same element and the callback of one
            // of them changes content dimensions of the observed target. Sometimes
            // this may result in notifications being blocked for the rest of observers.
            activeObservers.forEach(function (observer) { return observer.broadcastActive(); });
            return activeObservers.length > 0;
        };
        /**
         * Initializes DOM listeners.
         *
         * @private
         * @returns {void}
         */
        ResizeObserverController.prototype.connect_ = function () {
            // Do nothing if running in a non-browser environment or if listeners
            // have been already added.
            if (!isBrowser || this.connected_) {
                return;
            }
            // Subscription to the "Transitionend" event is used as a workaround for
            // delayed transitions. This way it's possible to capture at least the
            // final state of an element.
            document.addEventListener('transitionend', this.onTransitionEnd_);
            window.addEventListener('resize', this.refresh);
            if (mutationObserverSupported) {
                this.mutationsObserver_ = new MutationObserver(this.refresh);
                this.mutationsObserver_.observe(document, {
                    attributes: true,
                    childList: true,
                    characterData: true,
                    subtree: true
                });
            }
            else {
                document.addEventListener('DOMSubtreeModified', this.refresh);
                this.mutationEventsAdded_ = true;
            }
            this.connected_ = true;
        };
        /**
         * Removes DOM listeners.
         *
         * @private
         * @returns {void}
         */
        ResizeObserverController.prototype.disconnect_ = function () {
            // Do nothing if running in a non-browser environment or if listeners
            // have been already removed.
            if (!isBrowser || !this.connected_) {
                return;
            }
            document.removeEventListener('transitionend', this.onTransitionEnd_);
            window.removeEventListener('resize', this.refresh);
            if (this.mutationsObserver_) {
                this.mutationsObserver_.disconnect();
            }
            if (this.mutationEventsAdded_) {
                document.removeEventListener('DOMSubtreeModified', this.refresh);
            }
            this.mutationsObserver_ = null;
            this.mutationEventsAdded_ = false;
            this.connected_ = false;
        };
        /**
         * "Transitionend" event handler.
         *
         * @private
         * @param {TransitionEvent} event
         * @returns {void}
         */
        ResizeObserverController.prototype.onTransitionEnd_ = function (_a) {
            var _b = _a.propertyName, propertyName = _b === void 0 ? '' : _b;
            // Detect whether transition may affect dimensions of an element.
            var isReflowProperty = transitionKeys.some(function (key) {
                return !!~propertyName.indexOf(key);
            });
            if (isReflowProperty) {
                this.refresh();
            }
        };
        /**
         * Returns instance of the ResizeObserverController.
         *
         * @returns {ResizeObserverController}
         */
        ResizeObserverController.getInstance = function () {
            if (!this.instance_) {
                this.instance_ = new ResizeObserverController();
            }
            return this.instance_;
        };
        /**
         * Holds reference to the controller's instance.
         *
         * @private {ResizeObserverController}
         */
        ResizeObserverController.instance_ = null;
        return ResizeObserverController;
    }());

    /**
     * Defines non-writable/enumerable properties of the provided target object.
     *
     * @param {Object} target - Object for which to define properties.
     * @param {Object} props - Properties to be defined.
     * @returns {Object} Target object.
     */
    var defineConfigurable = (function (target, props) {
        for (var _i = 0, _a = Object.keys(props); _i < _a.length; _i++) {
            var key = _a[_i];
            Object.defineProperty(target, key, {
                value: props[key],
                enumerable: false,
                writable: false,
                configurable: true
            });
        }
        return target;
    });

    /**
     * Returns the global object associated with provided element.
     *
     * @param {Object} target
     * @returns {Object}
     */
    var getWindowOf = (function (target) {
        // Assume that the element is an instance of Node, which means that it
        // has the "ownerDocument" property from which we can retrieve a
        // corresponding global object.
        var ownerGlobal = target && target.ownerDocument && target.ownerDocument.defaultView;
        // Return the local global object if it's not possible extract one from
        // provided element.
        return ownerGlobal || global$1;
    });

    // Placeholder of an empty content rectangle.
    var emptyRect = createRectInit(0, 0, 0, 0);
    /**
     * Converts provided string to a number.
     *
     * @param {number|string} value
     * @returns {number}
     */
    function toFloat(value) {
        return parseFloat(value) || 0;
    }
    /**
     * Extracts borders size from provided styles.
     *
     * @param {CSSStyleDeclaration} styles
     * @param {...string} positions - Borders positions (top, right, ...)
     * @returns {number}
     */
    function getBordersSize(styles) {
        var positions = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            positions[_i - 1] = arguments[_i];
        }
        return positions.reduce(function (size, position) {
            var value = styles['border-' + position + '-width'];
            return size + toFloat(value);
        }, 0);
    }
    /**
     * Extracts paddings sizes from provided styles.
     *
     * @param {CSSStyleDeclaration} styles
     * @returns {Object} Paddings box.
     */
    function getPaddings(styles) {
        var positions = ['top', 'right', 'bottom', 'left'];
        var paddings = {};
        for (var _i = 0, positions_1 = positions; _i < positions_1.length; _i++) {
            var position = positions_1[_i];
            var value = styles['padding-' + position];
            paddings[position] = toFloat(value);
        }
        return paddings;
    }
    /**
     * Calculates content rectangle of provided SVG element.
     *
     * @param {SVGGraphicsElement} target - Element content rectangle of which needs
     *      to be calculated.
     * @returns {DOMRectInit}
     */
    function getSVGContentRect(target) {
        var bbox = target.getBBox();
        return createRectInit(0, 0, bbox.width, bbox.height);
    }
    /**
     * Calculates content rectangle of provided HTMLElement.
     *
     * @param {HTMLElement} target - Element for which to calculate the content rectangle.
     * @returns {DOMRectInit}
     */
    function getHTMLElementContentRect(target) {
        // Client width & height properties can't be
        // used exclusively as they provide rounded values.
        var clientWidth = target.clientWidth, clientHeight = target.clientHeight;
        // By this condition we can catch all non-replaced inline, hidden and
        // detached elements. Though elements with width & height properties less
        // than 0.5 will be discarded as well.
        //
        // Without it we would need to implement separate methods for each of
        // those cases and it's not possible to perform a precise and performance
        // effective test for hidden elements. E.g. even jQuery's ':visible' filter
        // gives wrong results for elements with width & height less than 0.5.
        if (!clientWidth && !clientHeight) {
            return emptyRect;
        }
        var styles = getWindowOf(target).getComputedStyle(target);
        var paddings = getPaddings(styles);
        var horizPad = paddings.left + paddings.right;
        var vertPad = paddings.top + paddings.bottom;
        // Computed styles of width & height are being used because they are the
        // only dimensions available to JS that contain non-rounded values. It could
        // be possible to utilize the getBoundingClientRect if only it's data wasn't
        // affected by CSS transformations let alone paddings, borders and scroll bars.
        var width = toFloat(styles.width), height = toFloat(styles.height);
        // Width & height include paddings and borders when the 'border-box' box
        // model is applied (except for IE).
        if (styles.boxSizing === 'border-box') {
            // Following conditions are required to handle Internet Explorer which
            // doesn't include paddings and borders to computed CSS dimensions.
            //
            // We can say that if CSS dimensions + paddings are equal to the "client"
            // properties then it's either IE, and thus we don't need to subtract
            // anything, or an element merely doesn't have paddings/borders styles.
            if (Math.round(width + horizPad) !== clientWidth) {
                width -= getBordersSize(styles, 'left', 'right') + horizPad;
            }
            if (Math.round(height + vertPad) !== clientHeight) {
                height -= getBordersSize(styles, 'top', 'bottom') + vertPad;
            }
        }
        // Following steps can't be applied to the document's root element as its
        // client[Width/Height] properties represent viewport area of the window.
        // Besides, it's as well not necessary as the <html> itself neither has
        // rendered scroll bars nor it can be clipped.
        if (!isDocumentElement(target)) {
            // In some browsers (only in Firefox, actually) CSS width & height
            // include scroll bars size which can be removed at this step as scroll
            // bars are the only difference between rounded dimensions + paddings
            // and "client" properties, though that is not always true in Chrome.
            var vertScrollbar = Math.round(width + horizPad) - clientWidth;
            var horizScrollbar = Math.round(height + vertPad) - clientHeight;
            // Chrome has a rather weird rounding of "client" properties.
            // E.g. for an element with content width of 314.2px it sometimes gives
            // the client width of 315px and for the width of 314.7px it may give
            // 314px. And it doesn't happen all the time. So just ignore this delta
            // as a non-relevant.
            if (Math.abs(vertScrollbar) !== 1) {
                width -= vertScrollbar;
            }
            if (Math.abs(horizScrollbar) !== 1) {
                height -= horizScrollbar;
            }
        }
        return createRectInit(paddings.left, paddings.top, width, height);
    }
    /**
     * Checks whether provided element is an instance of the SVGGraphicsElement.
     *
     * @param {Element} target - Element to be checked.
     * @returns {boolean}
     */
    var isSVGGraphicsElement = (function () {
        // Some browsers, namely IE and Edge, don't have the SVGGraphicsElement
        // interface.
        if (typeof SVGGraphicsElement !== 'undefined') {
            return function (target) { return target instanceof getWindowOf(target).SVGGraphicsElement; };
        }
        // If it's so, then check that element is at least an instance of the
        // SVGElement and that it has the "getBBox" method.
        // eslint-disable-next-line no-extra-parens
        return function (target) { return (target instanceof getWindowOf(target).SVGElement &&
            typeof target.getBBox === 'function'); };
    })();
    /**
     * Checks whether provided element is a document element (<html>).
     *
     * @param {Element} target - Element to be checked.
     * @returns {boolean}
     */
    function isDocumentElement(target) {
        return target === getWindowOf(target).document.documentElement;
    }
    /**
     * Calculates an appropriate content rectangle for provided html or svg element.
     *
     * @param {Element} target - Element content rectangle of which needs to be calculated.
     * @returns {DOMRectInit}
     */
    function getContentRect(target) {
        if (!isBrowser) {
            return emptyRect;
        }
        if (isSVGGraphicsElement(target)) {
            return getSVGContentRect(target);
        }
        return getHTMLElementContentRect(target);
    }
    /**
     * Creates rectangle with an interface of the DOMRectReadOnly.
     * Spec: https://drafts.fxtf.org/geometry/#domrectreadonly
     *
     * @param {DOMRectInit} rectInit - Object with rectangle's x/y coordinates and dimensions.
     * @returns {DOMRectReadOnly}
     */
    function createReadOnlyRect(_a) {
        var x = _a.x, y = _a.y, width = _a.width, height = _a.height;
        // If DOMRectReadOnly is available use it as a prototype for the rectangle.
        var Constr = typeof DOMRectReadOnly !== 'undefined' ? DOMRectReadOnly : Object;
        var rect = Object.create(Constr.prototype);
        // Rectangle's properties are not writable and non-enumerable.
        defineConfigurable(rect, {
            x: x, y: y, width: width, height: height,
            top: y,
            right: x + width,
            bottom: height + y,
            left: x
        });
        return rect;
    }
    /**
     * Creates DOMRectInit object based on the provided dimensions and the x/y coordinates.
     * Spec: https://drafts.fxtf.org/geometry/#dictdef-domrectinit
     *
     * @param {number} x - X coordinate.
     * @param {number} y - Y coordinate.
     * @param {number} width - Rectangle's width.
     * @param {number} height - Rectangle's height.
     * @returns {DOMRectInit}
     */
    function createRectInit(x, y, width, height) {
        return { x: x, y: y, width: width, height: height };
    }

    /**
     * Class that is responsible for computations of the content rectangle of
     * provided DOM element and for keeping track of it's changes.
     */
    var ResizeObservation = /** @class */ (function () {
        /**
         * Creates an instance of ResizeObservation.
         *
         * @param {Element} target - Element to be observed.
         */
        function ResizeObservation(target) {
            /**
             * Broadcasted width of content rectangle.
             *
             * @type {number}
             */
            this.broadcastWidth = 0;
            /**
             * Broadcasted height of content rectangle.
             *
             * @type {number}
             */
            this.broadcastHeight = 0;
            /**
             * Reference to the last observed content rectangle.
             *
             * @private {DOMRectInit}
             */
            this.contentRect_ = createRectInit(0, 0, 0, 0);
            this.target = target;
        }
        /**
         * Updates content rectangle and tells whether it's width or height properties
         * have changed since the last broadcast.
         *
         * @returns {boolean}
         */
        ResizeObservation.prototype.isActive = function () {
            var rect = getContentRect(this.target);
            this.contentRect_ = rect;
            return (rect.width !== this.broadcastWidth ||
                rect.height !== this.broadcastHeight);
        };
        /**
         * Updates 'broadcastWidth' and 'broadcastHeight' properties with a data
         * from the corresponding properties of the last observed content rectangle.
         *
         * @returns {DOMRectInit} Last observed content rectangle.
         */
        ResizeObservation.prototype.broadcastRect = function () {
            var rect = this.contentRect_;
            this.broadcastWidth = rect.width;
            this.broadcastHeight = rect.height;
            return rect;
        };
        return ResizeObservation;
    }());

    var ResizeObserverEntry = /** @class */ (function () {
        /**
         * Creates an instance of ResizeObserverEntry.
         *
         * @param {Element} target - Element that is being observed.
         * @param {DOMRectInit} rectInit - Data of the element's content rectangle.
         */
        function ResizeObserverEntry(target, rectInit) {
            var contentRect = createReadOnlyRect(rectInit);
            // According to the specification following properties are not writable
            // and are also not enumerable in the native implementation.
            //
            // Property accessors are not being used as they'd require to define a
            // private WeakMap storage which may cause memory leaks in browsers that
            // don't support this type of collections.
            defineConfigurable(this, { target: target, contentRect: contentRect });
        }
        return ResizeObserverEntry;
    }());

    var ResizeObserverSPI = /** @class */ (function () {
        /**
         * Creates a new instance of ResizeObserver.
         *
         * @param {ResizeObserverCallback} callback - Callback function that is invoked
         *      when one of the observed elements changes it's content dimensions.
         * @param {ResizeObserverController} controller - Controller instance which
         *      is responsible for the updates of observer.
         * @param {ResizeObserver} callbackCtx - Reference to the public
         *      ResizeObserver instance which will be passed to callback function.
         */
        function ResizeObserverSPI(callback, controller, callbackCtx) {
            /**
             * Collection of resize observations that have detected changes in dimensions
             * of elements.
             *
             * @private {Array<ResizeObservation>}
             */
            this.activeObservations_ = [];
            /**
             * Registry of the ResizeObservation instances.
             *
             * @private {Map<Element, ResizeObservation>}
             */
            this.observations_ = new MapShim();
            if (typeof callback !== 'function') {
                throw new TypeError('The callback provided as parameter 1 is not a function.');
            }
            this.callback_ = callback;
            this.controller_ = controller;
            this.callbackCtx_ = callbackCtx;
        }
        /**
         * Starts observing provided element.
         *
         * @param {Element} target - Element to be observed.
         * @returns {void}
         */
        ResizeObserverSPI.prototype.observe = function (target) {
            if (!arguments.length) {
                throw new TypeError('1 argument required, but only 0 present.');
            }
            // Do nothing if current environment doesn't have the Element interface.
            if (typeof Element === 'undefined' || !(Element instanceof Object)) {
                return;
            }
            if (!(target instanceof getWindowOf(target).Element)) {
                throw new TypeError('parameter 1 is not of type "Element".');
            }
            var observations = this.observations_;
            // Do nothing if element is already being observed.
            if (observations.has(target)) {
                return;
            }
            observations.set(target, new ResizeObservation(target));
            this.controller_.addObserver(this);
            // Force the update of observations.
            this.controller_.refresh();
        };
        /**
         * Stops observing provided element.
         *
         * @param {Element} target - Element to stop observing.
         * @returns {void}
         */
        ResizeObserverSPI.prototype.unobserve = function (target) {
            if (!arguments.length) {
                throw new TypeError('1 argument required, but only 0 present.');
            }
            // Do nothing if current environment doesn't have the Element interface.
            if (typeof Element === 'undefined' || !(Element instanceof Object)) {
                return;
            }
            if (!(target instanceof getWindowOf(target).Element)) {
                throw new TypeError('parameter 1 is not of type "Element".');
            }
            var observations = this.observations_;
            // Do nothing if element is not being observed.
            if (!observations.has(target)) {
                return;
            }
            observations.delete(target);
            if (!observations.size) {
                this.controller_.removeObserver(this);
            }
        };
        /**
         * Stops observing all elements.
         *
         * @returns {void}
         */
        ResizeObserverSPI.prototype.disconnect = function () {
            this.clearActive();
            this.observations_.clear();
            this.controller_.removeObserver(this);
        };
        /**
         * Collects observation instances the associated element of which has changed
         * it's content rectangle.
         *
         * @returns {void}
         */
        ResizeObserverSPI.prototype.gatherActive = function () {
            var _this = this;
            this.clearActive();
            this.observations_.forEach(function (observation) {
                if (observation.isActive()) {
                    _this.activeObservations_.push(observation);
                }
            });
        };
        /**
         * Invokes initial callback function with a list of ResizeObserverEntry
         * instances collected from active resize observations.
         *
         * @returns {void}
         */
        ResizeObserverSPI.prototype.broadcastActive = function () {
            // Do nothing if observer doesn't have active observations.
            if (!this.hasActive()) {
                return;
            }
            var ctx = this.callbackCtx_;
            // Create ResizeObserverEntry instance for every active observation.
            var entries = this.activeObservations_.map(function (observation) {
                return new ResizeObserverEntry(observation.target, observation.broadcastRect());
            });
            this.callback_.call(ctx, entries, ctx);
            this.clearActive();
        };
        /**
         * Clears the collection of active observations.
         *
         * @returns {void}
         */
        ResizeObserverSPI.prototype.clearActive = function () {
            this.activeObservations_.splice(0);
        };
        /**
         * Tells whether observer has active observations.
         *
         * @returns {boolean}
         */
        ResizeObserverSPI.prototype.hasActive = function () {
            return this.activeObservations_.length > 0;
        };
        return ResizeObserverSPI;
    }());

    // Registry of internal observers. If WeakMap is not available use current shim
    // for the Map collection as it has all required methods and because WeakMap
    // can't be fully polyfilled anyway.
    var observers = typeof WeakMap !== 'undefined' ? new WeakMap() : new MapShim();
    /**
     * ResizeObserver API. Encapsulates the ResizeObserver SPI implementation
     * exposing only those methods and properties that are defined in the spec.
     */
    var ResizeObserver = /** @class */ (function () {
        /**
         * Creates a new instance of ResizeObserver.
         *
         * @param {ResizeObserverCallback} callback - Callback that is invoked when
         *      dimensions of the observed elements change.
         */
        function ResizeObserver(callback) {
            if (!(this instanceof ResizeObserver)) {
                throw new TypeError('Cannot call a class as a function.');
            }
            if (!arguments.length) {
                throw new TypeError('1 argument required, but only 0 present.');
            }
            var controller = ResizeObserverController.getInstance();
            var observer = new ResizeObserverSPI(callback, controller, this);
            observers.set(this, observer);
        }
        return ResizeObserver;
    }());
    // Expose public methods of ResizeObserver.
    [
        'observe',
        'unobserve',
        'disconnect'
    ].forEach(function (method) {
        ResizeObserver.prototype[method] = function () {
            var _a;
            return (_a = observers.get(this))[method].apply(_a, arguments);
        };
    });

    var index = (function () {
        // Export existing implementation if available.
        if (typeof global$1.ResizeObserver !== 'undefined') {
            return global$1.ResizeObserver;
        }
        return ResizeObserver;
    })();

    var ResizeObserver_es = /*#__PURE__*/Object.freeze({
        __proto__: null,
        'default': index
    });

    /**
     * lodash (Custom Build) <https://lodash.com/>
     * Build: `lodash modularize exports="npm" -o ./`
     * Copyright jQuery Foundation and other contributors <https://jquery.org/>
     * Released under MIT license <https://lodash.com/license>
     * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
     * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
     */

    /** Used as the `TypeError` message for "Functions" methods. */
    var FUNC_ERROR_TEXT$1 = 'Expected a function';

    /** Used as references for various `Number` constants. */
    var NAN$1 = 0 / 0;

    /** `Object#toString` result references. */
    var symbolTag$1 = '[object Symbol]';

    /** Used to match leading and trailing whitespace. */
    var reTrim$1 = /^\s+|\s+$/g;

    /** Used to detect bad signed hexadecimal string values. */
    var reIsBadHex$1 = /^[-+]0x[0-9a-f]+$/i;

    /** Used to detect binary string values. */
    var reIsBinary$1 = /^0b[01]+$/i;

    /** Used to detect octal string values. */
    var reIsOctal$1 = /^0o[0-7]+$/i;

    /** Built-in method references without a dependency on `root`. */
    var freeParseInt$1 = parseInt;

    /** Detect free variable `global` from Node.js. */
    var freeGlobal$1 = typeof commonjsGlobal == 'object' && commonjsGlobal && commonjsGlobal.Object === Object && commonjsGlobal;

    /** Detect free variable `self`. */
    var freeSelf$1 = typeof self == 'object' && self && self.Object === Object && self;

    /** Used as a reference to the global object. */
    var root$1 = freeGlobal$1 || freeSelf$1 || Function('return this')();

    /** Used for built-in method references. */
    var objectProto$1 = Object.prototype;

    /**
     * Used to resolve the
     * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
     * of values.
     */
    var objectToString$1 = objectProto$1.toString;

    /* Built-in method references for those with the same name as other `lodash` methods. */
    var nativeMax$1 = Math.max,
        nativeMin$1 = Math.min;

    /**
     * Gets the timestamp of the number of milliseconds that have elapsed since
     * the Unix epoch (1 January 1970 00:00:00 UTC).
     *
     * @static
     * @memberOf _
     * @since 2.4.0
     * @category Date
     * @returns {number} Returns the timestamp.
     * @example
     *
     * _.defer(function(stamp) {
     *   console.log(_.now() - stamp);
     * }, _.now());
     * // => Logs the number of milliseconds it took for the deferred invocation.
     */
    var now$1 = function() {
      return root$1.Date.now();
    };

    /**
     * Creates a debounced function that delays invoking `func` until after `wait`
     * milliseconds have elapsed since the last time the debounced function was
     * invoked. The debounced function comes with a `cancel` method to cancel
     * delayed `func` invocations and a `flush` method to immediately invoke them.
     * Provide `options` to indicate whether `func` should be invoked on the
     * leading and/or trailing edge of the `wait` timeout. The `func` is invoked
     * with the last arguments provided to the debounced function. Subsequent
     * calls to the debounced function return the result of the last `func`
     * invocation.
     *
     * **Note:** If `leading` and `trailing` options are `true`, `func` is
     * invoked on the trailing edge of the timeout only if the debounced function
     * is invoked more than once during the `wait` timeout.
     *
     * If `wait` is `0` and `leading` is `false`, `func` invocation is deferred
     * until to the next tick, similar to `setTimeout` with a timeout of `0`.
     *
     * See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
     * for details over the differences between `_.debounce` and `_.throttle`.
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Function
     * @param {Function} func The function to debounce.
     * @param {number} [wait=0] The number of milliseconds to delay.
     * @param {Object} [options={}] The options object.
     * @param {boolean} [options.leading=false]
     *  Specify invoking on the leading edge of the timeout.
     * @param {number} [options.maxWait]
     *  The maximum time `func` is allowed to be delayed before it's invoked.
     * @param {boolean} [options.trailing=true]
     *  Specify invoking on the trailing edge of the timeout.
     * @returns {Function} Returns the new debounced function.
     * @example
     *
     * // Avoid costly calculations while the window size is in flux.
     * jQuery(window).on('resize', _.debounce(calculateLayout, 150));
     *
     * // Invoke `sendMail` when clicked, debouncing subsequent calls.
     * jQuery(element).on('click', _.debounce(sendMail, 300, {
     *   'leading': true,
     *   'trailing': false
     * }));
     *
     * // Ensure `batchLog` is invoked once after 1 second of debounced calls.
     * var debounced = _.debounce(batchLog, 250, { 'maxWait': 1000 });
     * var source = new EventSource('/stream');
     * jQuery(source).on('message', debounced);
     *
     * // Cancel the trailing debounced invocation.
     * jQuery(window).on('popstate', debounced.cancel);
     */
    function debounce$2(func, wait, options) {
      var lastArgs,
          lastThis,
          maxWait,
          result,
          timerId,
          lastCallTime,
          lastInvokeTime = 0,
          leading = false,
          maxing = false,
          trailing = true;

      if (typeof func != 'function') {
        throw new TypeError(FUNC_ERROR_TEXT$1);
      }
      wait = toNumber$1(wait) || 0;
      if (isObject$1(options)) {
        leading = !!options.leading;
        maxing = 'maxWait' in options;
        maxWait = maxing ? nativeMax$1(toNumber$1(options.maxWait) || 0, wait) : maxWait;
        trailing = 'trailing' in options ? !!options.trailing : trailing;
      }

      function invokeFunc(time) {
        var args = lastArgs,
            thisArg = lastThis;

        lastArgs = lastThis = undefined;
        lastInvokeTime = time;
        result = func.apply(thisArg, args);
        return result;
      }

      function leadingEdge(time) {
        // Reset any `maxWait` timer.
        lastInvokeTime = time;
        // Start the timer for the trailing edge.
        timerId = setTimeout(timerExpired, wait);
        // Invoke the leading edge.
        return leading ? invokeFunc(time) : result;
      }

      function remainingWait(time) {
        var timeSinceLastCall = time - lastCallTime,
            timeSinceLastInvoke = time - lastInvokeTime,
            result = wait - timeSinceLastCall;

        return maxing ? nativeMin$1(result, maxWait - timeSinceLastInvoke) : result;
      }

      function shouldInvoke(time) {
        var timeSinceLastCall = time - lastCallTime,
            timeSinceLastInvoke = time - lastInvokeTime;

        // Either this is the first call, activity has stopped and we're at the
        // trailing edge, the system time has gone backwards and we're treating
        // it as the trailing edge, or we've hit the `maxWait` limit.
        return (lastCallTime === undefined || (timeSinceLastCall >= wait) ||
          (timeSinceLastCall < 0) || (maxing && timeSinceLastInvoke >= maxWait));
      }

      function timerExpired() {
        var time = now$1();
        if (shouldInvoke(time)) {
          return trailingEdge(time);
        }
        // Restart the timer.
        timerId = setTimeout(timerExpired, remainingWait(time));
      }

      function trailingEdge(time) {
        timerId = undefined;

        // Only invoke if we have `lastArgs` which means `func` has been
        // debounced at least once.
        if (trailing && lastArgs) {
          return invokeFunc(time);
        }
        lastArgs = lastThis = undefined;
        return result;
      }

      function cancel() {
        if (timerId !== undefined) {
          clearTimeout(timerId);
        }
        lastInvokeTime = 0;
        lastArgs = lastCallTime = lastThis = timerId = undefined;
      }

      function flush() {
        return timerId === undefined ? result : trailingEdge(now$1());
      }

      function debounced() {
        var time = now$1(),
            isInvoking = shouldInvoke(time);

        lastArgs = arguments;
        lastThis = this;
        lastCallTime = time;

        if (isInvoking) {
          if (timerId === undefined) {
            return leadingEdge(lastCallTime);
          }
          if (maxing) {
            // Handle invocations in a tight loop.
            timerId = setTimeout(timerExpired, wait);
            return invokeFunc(lastCallTime);
          }
        }
        if (timerId === undefined) {
          timerId = setTimeout(timerExpired, wait);
        }
        return result;
      }
      debounced.cancel = cancel;
      debounced.flush = flush;
      return debounced;
    }

    /**
     * Checks if `value` is the
     * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
     * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Lang
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if `value` is an object, else `false`.
     * @example
     *
     * _.isObject({});
     * // => true
     *
     * _.isObject([1, 2, 3]);
     * // => true
     *
     * _.isObject(_.noop);
     * // => true
     *
     * _.isObject(null);
     * // => false
     */
    function isObject$1(value) {
      var type = typeof value;
      return !!value && (type == 'object' || type == 'function');
    }

    /**
     * Checks if `value` is object-like. A value is object-like if it's not `null`
     * and has a `typeof` result of "object".
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Lang
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
     * @example
     *
     * _.isObjectLike({});
     * // => true
     *
     * _.isObjectLike([1, 2, 3]);
     * // => true
     *
     * _.isObjectLike(_.noop);
     * // => false
     *
     * _.isObjectLike(null);
     * // => false
     */
    function isObjectLike$1(value) {
      return !!value && typeof value == 'object';
    }

    /**
     * Checks if `value` is classified as a `Symbol` primitive or object.
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Lang
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
     * @example
     *
     * _.isSymbol(Symbol.iterator);
     * // => true
     *
     * _.isSymbol('abc');
     * // => false
     */
    function isSymbol$1(value) {
      return typeof value == 'symbol' ||
        (isObjectLike$1(value) && objectToString$1.call(value) == symbolTag$1);
    }

    /**
     * Converts `value` to a number.
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Lang
     * @param {*} value The value to process.
     * @returns {number} Returns the number.
     * @example
     *
     * _.toNumber(3.2);
     * // => 3.2
     *
     * _.toNumber(Number.MIN_VALUE);
     * // => 5e-324
     *
     * _.toNumber(Infinity);
     * // => Infinity
     *
     * _.toNumber('3.2');
     * // => 3.2
     */
    function toNumber$1(value) {
      if (typeof value == 'number') {
        return value;
      }
      if (isSymbol$1(value)) {
        return NAN$1;
      }
      if (isObject$1(value)) {
        var other = typeof value.valueOf == 'function' ? value.valueOf() : value;
        value = isObject$1(other) ? (other + '') : other;
      }
      if (typeof value != 'string') {
        return value === 0 ? value : +value;
      }
      value = value.replace(reTrim$1, '');
      var isBinary = reIsBinary$1.test(value);
      return (isBinary || reIsOctal$1.test(value))
        ? freeParseInt$1(value.slice(2), isBinary ? 2 : 8)
        : (reIsBadHex$1.test(value) ? NAN$1 : +value);
    }

    var lodash_debounce = debounce$2;

    /*
      Focuses on some element in the currently topmost overlay.

      1. If there are some [data-uppy-super-focusable] elements rendered already - focuses on the first superfocusable element, and leaves focus up to the control of a user (until currently focused element disappears from the screen [which can happen when overlay changes, or, e.g., when we click on a folder in googledrive]).
      2. If there are no [data-uppy-super-focusable] elements yet (or ever) - focuses on the first focusable element, but switches focus if superfocusable elements appear on next render.
    */


    var createSuperFocus = function createSuperFocus() {
      var lastFocusWasOnSuperFocusableEl = false;

      var superFocus = function superFocus(dashboardEl, activeOverlayType) {
        var overlayEl = getActiveOverlayEl(dashboardEl, activeOverlayType);
        var isFocusInOverlay = overlayEl.contains(document.activeElement); // If focus is already in the topmost overlay, AND on last update we focused on the superfocusable element - then leave focus up to the user.
        // [Practical check] without this line, typing in the search input in googledrive overlay won't work.

        if (isFocusInOverlay && lastFocusWasOnSuperFocusableEl) return;
        var superFocusableEl = overlayEl.querySelector('[data-uppy-super-focusable]'); // If we are already in the topmost overlay, AND there are no super focusable elements yet, - leave focus up to the user.
        // [Practical check] without this line, if you are in an empty folder in google drive, and something's uploading in the bg, - focus will be jumping to Done all the time.

        if (isFocusInOverlay && !superFocusableEl) return;

        if (superFocusableEl) {
          superFocusableEl.focus({
            preventScroll: true
          });
          lastFocusWasOnSuperFocusableEl = true;
        } else {
          var firstEl = overlayEl.querySelector(FOCUSABLE_ELEMENTS);
          firstEl && firstEl.focus({
            preventScroll: true
          });
          lastFocusWasOnSuperFocusableEl = false;
        }
      }; // ___Why do we need to debounce?
      //    1. To deal with animations: overlay changes via animations, which results in the DOM updating AFTER plugin.update() already executed.
      //    [Practical check] without debounce, if we open the Url overlay, and click 'Done', Dashboard won't get focused again.
      //    [Practical check] if we delay 250ms instead of 260ms - IE11 won't get focused in same situation.
      //    2. Performance: there can be many state update()s in a second, and this function is called every time.


      return lodash_debounce(superFocus, 260);
    };

    var safeIsNaN = Number.isNaN ||
        function ponyfill(value) {
            return typeof value === 'number' && value !== value;
        };
    function isEqual(first, second) {
        if (first === second) {
            return true;
        }
        if (safeIsNaN(first) && safeIsNaN(second)) {
            return true;
        }
        return false;
    }
    function areInputsEqual(newInputs, lastInputs) {
        if (newInputs.length !== lastInputs.length) {
            return false;
        }
        for (var i = 0; i < newInputs.length; i++) {
            if (!isEqual(newInputs[i], lastInputs[i])) {
                return false;
            }
        }
        return true;
    }

    function memoizeOne(resultFn, isEqual) {
        if (isEqual === void 0) { isEqual = areInputsEqual; }
        var lastThis;
        var lastArgs = [];
        var lastResult;
        var calledOnce = false;
        function memoized() {
            var newArgs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                newArgs[_i] = arguments[_i];
            }
            if (calledOnce && lastThis === this && isEqual(newArgs, lastArgs)) {
                return lastResult;
            }
            lastResult = resultFn.apply(this, newArgs);
            calledOnce = true;
            lastThis = this;
            lastArgs = newArgs;
            return lastResult;
        }
        return memoized;
    }

    var memoizeOne_esm = /*#__PURE__*/Object.freeze({
        __proto__: null,
        'default': memoizeOne
    });

    var require$$0 = /*@__PURE__*/getAugmentedNamespace(ResizeObserver_es);

    var require$$1 = /*@__PURE__*/getAugmentedNamespace(memoizeOne_esm);

    var _class$3, _temp$3;

    function _extends$c() { _extends$c = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$c.apply(this, arguments); }

    function _assertThisInitialized$1(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _inheritsLoose$9(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; _setPrototypeOf$9(subClass, superClass); }

    function _setPrototypeOf$9(o, p) { _setPrototypeOf$9 = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$9(o, p); }

    var h$j = _require2.h;

    var Plugin$4 = lib$1.Plugin;























    var ResizeObserver$1 = require$$0.default || require$$0;



    var memoize = require$$1.default || require$$1;



    var TAB_KEY = 9;
    var ESC_KEY = 27;

    function createPromise() {
      var o = {};
      o.promise = new Promise(function (resolve, reject) {
        o.resolve = resolve;
        o.reject = reject;
      });
      return o;
    }

    function defaultPickerIcon() {
      return h$j("svg", {
        "aria-hidden": "true",
        focusable: "false",
        width: "30",
        height: "30",
        viewBox: "0 0 30 30"
      }, h$j("path", {
        d: "M15 30c8.284 0 15-6.716 15-15 0-8.284-6.716-15-15-15C6.716 0 0 6.716 0 15c0 8.284 6.716 15 15 15zm4.258-12.676v6.846h-8.426v-6.846H5.204l9.82-12.364 9.82 12.364H19.26z"
      }));
    }
    /**
     * Dashboard UI with previews, metadata editing, tabs for various services and more
     */


    var lib$5 = (_temp$3 = _class$3 = /*#__PURE__*/function (_Plugin) {
      _inheritsLoose$9(Dashboard$1, _Plugin);

      function Dashboard$1(uppy, _opts) {
        var _this;

        _this = _Plugin.call(this, uppy, _opts) || this;

        _this.setOptions = function (newOpts) {
          _Plugin.prototype.setOptions.call(_assertThisInitialized$1(_this), newOpts);

          _this.i18nInit();
        };

        _this.i18nInit = function () {
          _this.translator = new Translator([_this.defaultLocale, _this.uppy.locale, _this.opts.locale]);
          _this.i18n = _this.translator.translate.bind(_this.translator);
          _this.i18nArray = _this.translator.translateArray.bind(_this.translator);

          _this.setPluginState(); // so that UI re-renders and we see the updated locale

        };

        _this.removeTarget = function (plugin) {
          var pluginState = _this.getPluginState(); // filter out the one we want to remove


          var newTargets = pluginState.targets.filter(function (target) {
            return target.id !== plugin.id;
          });

          _this.setPluginState({
            targets: newTargets
          });
        };

        _this.addTarget = function (plugin) {
          var callerPluginId = plugin.id || plugin.constructor.name;
          var callerPluginName = plugin.title || callerPluginId;
          var callerPluginType = plugin.type;

          if (callerPluginType !== 'acquirer' && callerPluginType !== 'progressindicator' && callerPluginType !== 'editor') {
            var msg = 'Dashboard: can only be targeted by plugins of types: acquirer, progressindicator, editor';

            _this.uppy.log(msg, 'error');

            return;
          }

          var target = {
            id: callerPluginId,
            name: callerPluginName,
            type: callerPluginType
          };

          var state = _this.getPluginState();

          var newTargets = state.targets.slice();
          newTargets.push(target);

          _this.setPluginState({
            targets: newTargets
          });

          return _this.el;
        };

        _this.hideAllPanels = function () {
          var update = {
            activePickerPanel: false,
            showAddFilesPanel: false,
            activeOverlayType: null,
            fileCardFor: null,
            showFileEditor: false
          };

          var current = _this.getPluginState();

          if (current.activePickerPanel === update.activePickerPanel && current.showAddFilesPanel === update.showAddFilesPanel && current.showFileEditor === update.showFileEditor && current.activeOverlayType === update.activeOverlayType) {
            // avoid doing a state update if nothing changed
            return;
          }

          _this.setPluginState(update);
        };

        _this.showPanel = function (id) {
          var _this$getPluginState = _this.getPluginState(),
              targets = _this$getPluginState.targets;

          var activePickerPanel = targets.filter(function (target) {
            return target.type === 'acquirer' && target.id === id;
          })[0];

          _this.setPluginState({
            activePickerPanel: activePickerPanel,
            activeOverlayType: 'PickerPanel'
          });
        };

        _this.canEditFile = function (file) {
          var _this$getPluginState2 = _this.getPluginState(),
              targets = _this$getPluginState2.targets;

          var editors = _this._getEditors(targets);

          return editors.some(function (target) {
            return _this.uppy.getPlugin(target.id).canEditFile(file);
          });
        };

        _this.openFileEditor = function (file) {
          var _this$getPluginState3 = _this.getPluginState(),
              targets = _this$getPluginState3.targets;

          var editors = _this._getEditors(targets);

          _this.setPluginState({
            showFileEditor: true,
            fileCardFor: file.id || null,
            activeOverlayType: 'FileEditor'
          });

          editors.forEach(function (editor) {
            _this.uppy.getPlugin(editor.id).selectFile(file);
          });
        };

        _this.openModal = function () {
          var _createPromise = createPromise(),
              promise = _createPromise.promise,
              resolve = _createPromise.resolve; // save scroll position


          _this.savedScrollPosition = window.pageYOffset; // save active element, so we can restore focus when modal is closed

          _this.savedActiveElement = document.activeElement;

          if (_this.opts.disablePageScrollWhenModalOpen) {
            document.body.classList.add('uppy-Dashboard-isFixed');
          }

          if (_this.opts.animateOpenClose && _this.getPluginState().isClosing) {
            var handler = function handler() {
              _this.setPluginState({
                isHidden: false
              });

              _this.el.removeEventListener('animationend', handler, false);

              resolve();
            };

            _this.el.addEventListener('animationend', handler, false);
          } else {
            _this.setPluginState({
              isHidden: false
            });

            resolve();
          }

          if (_this.opts.browserBackButtonClose) {
            _this.updateBrowserHistory();
          } // handle ESC and TAB keys in modal dialog


          document.addEventListener('keydown', _this.handleKeyDownInModal);

          _this.uppy.emit('dashboard:modal-open');

          return promise;
        };

        _this.closeModal = function (opts) {
          if (opts === void 0) {
            opts = {};
          }

          var _opts2 = opts,
              _opts2$manualClose = _opts2.manualClose,
              manualClose = _opts2$manualClose === void 0 ? true : _opts2$manualClose;

          var _this$getPluginState4 = _this.getPluginState(),
              isHidden = _this$getPluginState4.isHidden,
              isClosing = _this$getPluginState4.isClosing;

          if (isHidden || isClosing) {
            // short-circuit if animation is ongoing
            return;
          }

          var _createPromise2 = createPromise(),
              promise = _createPromise2.promise,
              resolve = _createPromise2.resolve;

          if (_this.opts.disablePageScrollWhenModalOpen) {
            document.body.classList.remove('uppy-Dashboard-isFixed');
          }

          if (_this.opts.animateOpenClose) {
            _this.setPluginState({
              isClosing: true
            });

            var handler = function handler() {
              _this.setPluginState({
                isHidden: true,
                isClosing: false
              });

              _this.superFocus.cancel();

              _this.savedActiveElement.focus();

              _this.el.removeEventListener('animationend', handler, false);

              resolve();
            };

            _this.el.addEventListener('animationend', handler, false);
          } else {
            _this.setPluginState({
              isHidden: true
            });

            _this.superFocus.cancel();

            _this.savedActiveElement.focus();

            resolve();
          } // handle ESC and TAB keys in modal dialog


          document.removeEventListener('keydown', _this.handleKeyDownInModal);

          if (manualClose) {
            if (_this.opts.browserBackButtonClose) {
              // Make sure that the latest entry in the history state is our modal name
              if (history.state && history.state[_this.modalName]) {
                // Go back in history to clear out the entry we created (ultimately closing the modal)
                history.go(-1);
              }
            }
          }

          _this.uppy.emit('dashboard:modal-closed');

          return promise;
        };

        _this.isModalOpen = function () {
          return !_this.getPluginState().isHidden || false;
        };

        _this.requestCloseModal = function () {
          if (_this.opts.onRequestCloseModal) {
            return _this.opts.onRequestCloseModal();
          }

          return _this.closeModal();
        };

        _this.setDarkModeCapability = function (isDarkModeOn) {
          var _this$uppy$getState = _this.uppy.getState(),
              capabilities = _this$uppy$getState.capabilities;

          _this.uppy.setState({
            capabilities: _extends$c({}, capabilities, {
              darkMode: isDarkModeOn
            })
          });
        };

        _this.handleSystemDarkModeChange = function (event) {
          var isDarkModeOnNow = event.matches;

          _this.uppy.log("[Dashboard] Dark mode is " + (isDarkModeOnNow ? 'on' : 'off'));

          _this.setDarkModeCapability(isDarkModeOnNow);
        };

        _this.toggleFileCard = function (show, fileID) {
          var file = _this.uppy.getFile(fileID);

          if (show) {
            _this.uppy.emit('dashboard:file-edit-start', file);
          } else {
            _this.uppy.emit('dashboard:file-edit-complete', file);
          }

          _this.setPluginState({
            fileCardFor: show ? fileID : null,
            activeOverlayType: show ? 'FileCard' : null
          });
        };

        _this.toggleAddFilesPanel = function (show) {
          _this.setPluginState({
            showAddFilesPanel: show,
            activeOverlayType: show ? 'AddFiles' : null
          });
        };

        _this.addFiles = function (files) {
          var descriptors = files.map(function (file) {
            return {
              source: _this.id,
              name: file.name,
              type: file.type,
              data: file,
              meta: {
                // path of the file relative to the ancestor directory the user selected.
                // e.g. 'docs/Old Prague/airbnb.pdf'
                relativePath: file.relativePath || null
              }
            };
          });

          try {
            _this.uppy.addFiles(descriptors);
          } catch (err) {
            _this.uppy.log(err);
          }
        };

        _this.startListeningToResize = function () {
          // Watch for Dashboard container (`.uppy-Dashboard-inner`) resize
          // and update containerWidth/containerHeight in plugin state accordingly.
          // Emits first event on initialization.
          _this.resizeObserver = new ResizeObserver$1(function (entries, observer) {
            var uppyDashboardInnerEl = entries[0];
            var _uppyDashboardInnerEl = uppyDashboardInnerEl.contentRect,
                width = _uppyDashboardInnerEl.width,
                height = _uppyDashboardInnerEl.height;

            _this.uppy.log("[Dashboard] resized: " + width + " / " + height, 'debug');

            _this.setPluginState({
              containerWidth: width,
              containerHeight: height,
              areInsidesReadyToBeVisible: true
            });
          });

          _this.resizeObserver.observe(_this.el.querySelector('.uppy-Dashboard-inner')); // If ResizeObserver fails to emit an event telling us what size to use - default to the mobile view


          _this.makeDashboardInsidesVisibleAnywayTimeout = setTimeout(function () {
            var pluginState = _this.getPluginState();

            var isModalAndClosed = !_this.opts.inline && pluginState.isHidden;

            if ( // if ResizeObserver hasn't yet fired,
            !pluginState.areInsidesReadyToBeVisible // and it's not due to the modal being closed
            && !isModalAndClosed) {
              _this.uppy.log("[Dashboard] resize event didn't fire on time: defaulted to mobile layout", 'debug');

              _this.setPluginState({
                areInsidesReadyToBeVisible: true
              });
            }
          }, 1000);
        };

        _this.stopListeningToResize = function () {
          _this.resizeObserver.disconnect();

          clearTimeout(_this.makeDashboardInsidesVisibleAnywayTimeout);
        };

        _this.recordIfFocusedOnUppyRecently = function (event) {
          if (_this.el.contains(event.target)) {
            _this.ifFocusedOnUppyRecently = true;
          } else {
            _this.ifFocusedOnUppyRecently = false; // ___Why run this.superFocus.cancel here when it already runs in superFocusOnEachUpdate?
            //    Because superFocus is debounced, when we move from Uppy to some other element on the page,
            //    previously run superFocus sometimes hits and moves focus back to Uppy.

            _this.superFocus.cancel();
          }
        };

        _this.disableAllFocusableElements = function (disable) {
          var focusableNodes = toArray(_this.el.querySelectorAll(FOCUSABLE_ELEMENTS));

          if (disable) {
            focusableNodes.forEach(function (node) {
              // save previous tabindex in a data-attribute, to restore when enabling
              var currentTabIndex = node.getAttribute('tabindex');

              if (currentTabIndex) {
                node.dataset.inertTabindex = currentTabIndex;
              }

              node.setAttribute('tabindex', '-1');
            });
          } else {
            focusableNodes.forEach(function (node) {
              if ('inertTabindex' in node.dataset) {
                node.setAttribute('tabindex', node.dataset.inertTabindex);
              } else {
                node.removeAttribute('tabindex');
              }
            });
          }

          _this.dashboardIsDisabled = disable;
        };

        _this.updateBrowserHistory = function () {
          // Ensure history state does not already contain our modal name to avoid double-pushing
          if (!history.state || !history.state[_this.modalName]) {
            var _extends2;

            // Push to history so that the page is not lost on browser back button press
            history.pushState(_extends$c({}, history.state, (_extends2 = {}, _extends2[_this.modalName] = true, _extends2)), '');
          } // Listen for back button presses


          window.addEventListener('popstate', _this.handlePopState, false);
        };

        _this.handlePopState = function (event) {
          // Close the modal if the history state no longer contains our modal name
          if (_this.isModalOpen() && (!event.state || !event.state[_this.modalName])) {
            _this.closeModal({
              manualClose: false
            });
          } // When the browser back button is pressed and uppy is now the latest entry in the history but the modal is closed, fix the history by removing the uppy history entry
          // This occurs when another entry is added into the history state while the modal is open, and then the modal gets manually closed
          // Solves PR #575 (https://github.com/transloadit/uppy/pull/575)


          if (!_this.isModalOpen() && event.state && event.state[_this.modalName]) {
            history.go(-1);
          }
        };

        _this.handleKeyDownInModal = function (event) {
          // close modal on esc key press
          if (event.keyCode === ESC_KEY) _this.requestCloseModal(event); // trap focus on tab key press

          if (event.keyCode === TAB_KEY) trapFocus_1.forModal(event, _this.getPluginState().activeOverlayType, _this.el);
        };

        _this.handleClickOutside = function () {
          if (_this.opts.closeModalOnClickOutside) _this.requestCloseModal();
        };

        _this.handlePaste = function (event) {
          // 1. Let any acquirer plugin (Url/Webcam/etc.) handle pastes to the root
          _this.uppy.iteratePlugins(function (plugin) {
            if (plugin.type === 'acquirer') {
              // Every Plugin with .type acquirer can define handleRootPaste(event)
              plugin.handleRootPaste && plugin.handleRootPaste(event);
            }
          }); // 2. Add all dropped files


          var files = toArray(event.clipboardData.files);

          _this.addFiles(files);
        };

        _this.handleInputChange = function (event) {
          event.preventDefault();
          var files = toArray(event.target.files);

          _this.addFiles(files);
        };

        _this.handleDragOver = function (event) {
          event.preventDefault();
          event.stopPropagation();

          if (_this.opts.disabled || _this.opts.disableLocalFiles) {
            return;
          } // 1. Add a small (+) icon on drop
          // (and prevent browsers from interpreting this as files being _moved_ into the browser, https://github.com/transloadit/uppy/issues/1978)


          event.dataTransfer.dropEffect = 'copy';
          clearTimeout(_this.removeDragOverClassTimeout);

          _this.setPluginState({
            isDraggingOver: true
          });
        };

        _this.handleDragLeave = function (event) {
          event.preventDefault();
          event.stopPropagation();

          if (_this.opts.disabled || _this.opts.disableLocalFiles) {
            return;
          }

          clearTimeout(_this.removeDragOverClassTimeout); // Timeout against flickering, this solution is taken from drag-drop library. Solution with 'pointer-events: none' didn't work across browsers.

          _this.removeDragOverClassTimeout = setTimeout(function () {
            _this.setPluginState({
              isDraggingOver: false
            });
          }, 50);
        };

        _this.handleDrop = function (event, dropCategory) {
          event.preventDefault();
          event.stopPropagation();

          if (_this.opts.disabled || _this.opts.disableLocalFiles) {
            return;
          }

          clearTimeout(_this.removeDragOverClassTimeout); // 2. Remove dragover class

          _this.setPluginState({
            isDraggingOver: false
          }); // 3. Let any acquirer plugin (Url/Webcam/etc.) handle drops to the root


          _this.uppy.iteratePlugins(function (plugin) {
            if (plugin.type === 'acquirer') {
              // Every Plugin with .type acquirer can define handleRootDrop(event)
              plugin.handleRootDrop && plugin.handleRootDrop(event);
            }
          }); // 4. Add all dropped files


          var executedDropErrorOnce = false;

          var logDropError = function logDropError(error) {
            _this.uppy.log(error, 'error'); // In practice all drop errors are most likely the same, so let's just show one to avoid overwhelming the user


            if (!executedDropErrorOnce) {
              _this.uppy.info(error.message, 'error');

              executedDropErrorOnce = true;
            }
          };

          getDroppedFiles(event.dataTransfer, {
            logDropError: logDropError
          }).then(function (files) {
            if (files.length > 0) {
              _this.uppy.log('[Dashboard] Files were dropped');

              _this.addFiles(files);
            }
          });
        };

        _this.handleRequestThumbnail = function (file) {
          if (!_this.opts.waitForThumbnailsBeforeUpload) {
            _this.uppy.emit('thumbnail:request', file);
          }
        };

        _this.handleCancelThumbnail = function (file) {
          if (!_this.opts.waitForThumbnailsBeforeUpload) {
            _this.uppy.emit('thumbnail:cancel', file);
          }
        };

        _this.handleKeyDownInInline = function (event) {
          // Trap focus on tab key press.
          if (event.keyCode === TAB_KEY) trapFocus_1.forInline(event, _this.getPluginState().activeOverlayType, _this.el);
        };

        _this.handlePasteOnBody = function (event) {
          var isFocusInOverlay = _this.el.contains(document.activeElement);

          if (isFocusInOverlay) {
            _this.handlePaste(event);
          }
        };

        _this.handleComplete = function (_ref) {
          var failed = _ref.failed;

          if (_this.opts.closeAfterFinish && failed.length === 0) {
            // All uploads are done
            _this.requestCloseModal();
          }
        };

        _this._openFileEditorWhenFilesAdded = function (files) {
          var firstFile = files[0];

          if (_this.canEditFile(firstFile)) {
            _this.openFileEditor(firstFile);
          }
        };

        _this.initEvents = function () {
          // Modal open button
          if (_this.opts.trigger && !_this.opts.inline) {
            var showModalTrigger = findAllDOMElements(_this.opts.trigger);

            if (showModalTrigger) {
              showModalTrigger.forEach(function (trigger) {
                return trigger.addEventListener('click', _this.openModal);
              });
            } else {
              _this.uppy.log('Dashboard modal trigger not found. Make sure `trigger` is set in Dashboard options, unless you are planning to call `dashboard.openModal()` method yourself', 'warning');
            }
          }

          _this.startListeningToResize();

          document.addEventListener('paste', _this.handlePasteOnBody);

          _this.uppy.on('plugin-remove', _this.removeTarget);

          _this.uppy.on('file-added', _this.hideAllPanels);

          _this.uppy.on('dashboard:modal-closed', _this.hideAllPanels);

          _this.uppy.on('file-editor:complete', _this.hideAllPanels);

          _this.uppy.on('complete', _this.handleComplete); // ___Why fire on capture?
          //    Because this.ifFocusedOnUppyRecently needs to change before onUpdate() fires.


          document.addEventListener('focus', _this.recordIfFocusedOnUppyRecently, true);
          document.addEventListener('click', _this.recordIfFocusedOnUppyRecently, true);

          if (_this.opts.inline) {
            _this.el.addEventListener('keydown', _this.handleKeyDownInInline);
          }

          if (_this.opts.autoOpenFileEditor) {
            _this.uppy.on('files-added', _this._openFileEditorWhenFilesAdded);
          }
        };

        _this.removeEvents = function () {
          var showModalTrigger = findAllDOMElements(_this.opts.trigger);

          if (!_this.opts.inline && showModalTrigger) {
            showModalTrigger.forEach(function (trigger) {
              return trigger.removeEventListener('click', _this.openModal);
            });
          }

          _this.stopListeningToResize();

          document.removeEventListener('paste', _this.handlePasteOnBody);
          window.removeEventListener('popstate', _this.handlePopState, false);

          _this.uppy.off('plugin-remove', _this.removeTarget);

          _this.uppy.off('file-added', _this.hideAllPanels);

          _this.uppy.off('dashboard:modal-closed', _this.hideAllPanels);

          _this.uppy.off('complete', _this.handleComplete);

          document.removeEventListener('focus', _this.recordIfFocusedOnUppyRecently);
          document.removeEventListener('click', _this.recordIfFocusedOnUppyRecently);

          if (_this.opts.inline) {
            _this.el.removeEventListener('keydown', _this.handleKeyDownInInline);
          }

          if (_this.opts.autoOpenFileEditor) {
            _this.uppy.off('files-added', _this._openFileEditorWhenFilesAdded);
          }
        };

        _this.superFocusOnEachUpdate = function () {
          var isFocusInUppy = _this.el.contains(document.activeElement); // When focus is lost on the page (== focus is on body for most browsers, or focus is null for IE11)


          var isFocusNowhere = document.activeElement === document.body || document.activeElement === null;

          var isInformerHidden = _this.uppy.getState().info.isHidden;

          var isModal = !_this.opts.inline;

          if ( // If update is connected to showing the Informer - let the screen reader calmly read it.
          isInformerHidden && ( // If we are in a modal - always superfocus without concern for other elements on the page (user is unlikely to want to interact with the rest of the page)
          isModal // If we are already inside of Uppy, or
          || isFocusInUppy // If we are not focused on anything BUT we have already, at least once, focused on uppy
          //   1. We focus when isFocusNowhere, because when the element we were focused on disappears (e.g. an overlay), - focus gets lost. If user is typing something somewhere else on the page, - focus won't be 'nowhere'.
          //   2. We only focus when focus is nowhere AND this.ifFocusedOnUppyRecently, to avoid focus jumps if we do something else on the page.
          //   [Practical check] Without '&& this.ifFocusedOnUppyRecently', in Safari, in inline mode, when file is uploading, - navigate via tab to the checkbox, try to press space multiple times. Focus will jump to Uppy.
          || isFocusNowhere && _this.ifFocusedOnUppyRecently)) {
            _this.superFocus(_this.el, _this.getPluginState().activeOverlayType);
          } else {
            _this.superFocus.cancel();
          }
        };

        _this.afterUpdate = function () {
          if (_this.opts.disabled && !_this.dashboardIsDisabled) {
            _this.disableAllFocusableElements(true);

            return;
          }

          if (!_this.opts.disabled && _this.dashboardIsDisabled) {
            _this.disableAllFocusableElements(false);
          }

          _this.superFocusOnEachUpdate();
        };

        _this.cancelUpload = function (fileID) {
          _this.uppy.removeFile(fileID);
        };

        _this.saveFileCard = function (meta, fileID) {
          _this.uppy.setFileMeta(fileID, meta);

          _this.toggleFileCard(false, fileID);
        };

        _this._attachRenderFunctionToTarget = function (target) {
          var plugin = _this.uppy.getPlugin(target.id);

          return _extends$c({}, target, {
            icon: plugin.icon || _this.opts.defaultPickerIcon,
            render: plugin.render
          });
        };

        _this._isTargetSupported = function (target) {
          var plugin = _this.uppy.getPlugin(target.id); // If the plugin does not provide a `supported` check, assume the plugin works everywhere.


          if (typeof plugin.isSupported !== 'function') {
            return true;
          }

          return plugin.isSupported();
        };

        _this._getAcquirers = memoize(function (targets) {
          return targets.filter(function (target) {
            return target.type === 'acquirer' && _this._isTargetSupported(target);
          }).map(_this._attachRenderFunctionToTarget);
        });
        _this._getProgressIndicators = memoize(function (targets) {
          return targets.filter(function (target) {
            return target.type === 'progressindicator';
          }).map(_this._attachRenderFunctionToTarget);
        });
        _this._getEditors = memoize(function (targets) {
          return targets.filter(function (target) {
            return target.type === 'editor';
          }).map(_this._attachRenderFunctionToTarget);
        });

        _this.render = function (state) {
          var pluginState = _this.getPluginState();

          var files = state.files,
              capabilities = state.capabilities,
              allowNewUpload = state.allowNewUpload; // TODO: move this to Core, to share between Status Bar and Dashboard
          // (and any other plugin that might need it, too)

          var newFiles = Object.keys(files).filter(function (file) {
            return !files[file].progress.uploadStarted;
          });
          var uploadStartedFiles = Object.keys(files).filter(function (file) {
            return files[file].progress.uploadStarted;
          });
          var pausedFiles = Object.keys(files).filter(function (file) {
            return files[file].isPaused;
          });
          var completeFiles = Object.keys(files).filter(function (file) {
            return files[file].progress.uploadComplete;
          });
          var erroredFiles = Object.keys(files).filter(function (file) {
            return files[file].error;
          });
          var inProgressFiles = Object.keys(files).filter(function (file) {
            return !files[file].progress.uploadComplete && files[file].progress.uploadStarted;
          });
          var inProgressNotPausedFiles = inProgressFiles.filter(function (file) {
            return !files[file].isPaused;
          });
          var processingFiles = Object.keys(files).filter(function (file) {
            return files[file].progress.preprocess || files[file].progress.postprocess;
          });
          var isUploadStarted = uploadStartedFiles.length > 0;
          var isAllComplete = state.totalProgress === 100 && completeFiles.length === Object.keys(files).length && processingFiles.length === 0;
          var isAllErrored = isUploadStarted && erroredFiles.length === uploadStartedFiles.length;
          var isAllPaused = inProgressFiles.length !== 0 && pausedFiles.length === inProgressFiles.length;

          var acquirers = _this._getAcquirers(pluginState.targets);

          var progressindicators = _this._getProgressIndicators(pluginState.targets);

          var editors = _this._getEditors(pluginState.targets);

          var theme;

          if (_this.opts.theme === 'auto') {
            theme = capabilities.darkMode ? 'dark' : 'light';
          } else {
            theme = _this.opts.theme;
          }

          if (['files', 'folders', 'both'].indexOf(_this.opts.fileManagerSelectionType) < 0) {
            _this.opts.fileManagerSelectionType = 'files';
            console.error("Unsupported option for \"fileManagerSelectionType\". Using default of \"" + _this.opts.fileManagerSelectionType + "\".");
          }

          return Dashboard({
            state: state,
            isHidden: pluginState.isHidden,
            files: files,
            newFiles: newFiles,
            uploadStartedFiles: uploadStartedFiles,
            completeFiles: completeFiles,
            erroredFiles: erroredFiles,
            inProgressFiles: inProgressFiles,
            inProgressNotPausedFiles: inProgressNotPausedFiles,
            processingFiles: processingFiles,
            isUploadStarted: isUploadStarted,
            isAllComplete: isAllComplete,
            isAllErrored: isAllErrored,
            isAllPaused: isAllPaused,
            totalFileCount: Object.keys(files).length,
            totalProgress: state.totalProgress,
            allowNewUpload: allowNewUpload,
            acquirers: acquirers,
            theme: theme,
            disabled: _this.opts.disabled,
            disableLocalFiles: _this.opts.disableLocalFiles,
            direction: _this.opts.direction,
            activePickerPanel: pluginState.activePickerPanel,
            showFileEditor: pluginState.showFileEditor,
            disableAllFocusableElements: _this.disableAllFocusableElements,
            animateOpenClose: _this.opts.animateOpenClose,
            isClosing: pluginState.isClosing,
            getPlugin: _this.uppy.getPlugin,
            progressindicators: progressindicators,
            editors: editors,
            autoProceed: _this.uppy.opts.autoProceed,
            id: _this.id,
            closeModal: _this.requestCloseModal,
            handleClickOutside: _this.handleClickOutside,
            handleInputChange: _this.handleInputChange,
            handlePaste: _this.handlePaste,
            inline: _this.opts.inline,
            showPanel: _this.showPanel,
            hideAllPanels: _this.hideAllPanels,
            log: _this.uppy.log,
            i18n: _this.i18n,
            i18nArray: _this.i18nArray,
            removeFile: _this.uppy.removeFile,
            uppy: _this.uppy,
            info: _this.uppy.info,
            note: _this.opts.note,
            metaFields: pluginState.metaFields,
            resumableUploads: capabilities.resumableUploads || false,
            individualCancellation: capabilities.individualCancellation,
            isMobileDevice: capabilities.isMobileDevice,
            pauseUpload: _this.uppy.pauseResume,
            retryUpload: _this.uppy.retryUpload,
            cancelUpload: _this.cancelUpload,
            cancelAll: _this.uppy.cancelAll,
            fileCardFor: pluginState.fileCardFor,
            toggleFileCard: _this.toggleFileCard,
            toggleAddFilesPanel: _this.toggleAddFilesPanel,
            showAddFilesPanel: pluginState.showAddFilesPanel,
            saveFileCard: _this.saveFileCard,
            openFileEditor: _this.openFileEditor,
            canEditFile: _this.canEditFile,
            width: _this.opts.width,
            height: _this.opts.height,
            showLinkToFileUploadResult: _this.opts.showLinkToFileUploadResult,
            fileManagerSelectionType: _this.opts.fileManagerSelectionType,
            proudlyDisplayPoweredByUppy: _this.opts.proudlyDisplayPoweredByUppy,
            hideCancelButton: _this.opts.hideCancelButton,
            hideRetryButton: _this.opts.hideRetryButton,
            hidePauseResumeButton: _this.opts.hidePauseResumeButton,
            showRemoveButtonAfterComplete: _this.opts.showRemoveButtonAfterComplete,
            containerWidth: pluginState.containerWidth,
            containerHeight: pluginState.containerHeight,
            areInsidesReadyToBeVisible: pluginState.areInsidesReadyToBeVisible,
            isTargetDOMEl: _this.isTargetDOMEl,
            parentElement: _this.el,
            allowedFileTypes: _this.uppy.opts.restrictions.allowedFileTypes,
            maxNumberOfFiles: _this.uppy.opts.restrictions.maxNumberOfFiles,
            showSelectedFiles: _this.opts.showSelectedFiles,
            handleRequestThumbnail: _this.handleRequestThumbnail,
            handleCancelThumbnail: _this.handleCancelThumbnail,
            // drag props
            isDraggingOver: pluginState.isDraggingOver,
            handleDragOver: _this.handleDragOver,
            handleDragLeave: _this.handleDragLeave,
            handleDrop: _this.handleDrop
          });
        };

        _this.discoverProviderPlugins = function () {
          _this.uppy.iteratePlugins(function (plugin) {
            if (plugin && !plugin.target && plugin.opts && plugin.opts.target === _this.constructor) {
              _this.addTarget(plugin);
            }
          });
        };

        _this.install = function () {
          // Set default state for Dashboard
          _this.setPluginState({
            isHidden: true,
            fileCardFor: null,
            activeOverlayType: null,
            showAddFilesPanel: false,
            activePickerPanel: false,
            showFileEditor: false,
            metaFields: _this.opts.metaFields,
            targets: [],
            // We'll make them visible once .containerWidth is determined
            areInsidesReadyToBeVisible: false,
            isDraggingOver: false
          });

          var _this$opts = _this.opts,
              inline = _this$opts.inline,
              closeAfterFinish = _this$opts.closeAfterFinish;

          if (inline && closeAfterFinish) {
            throw new Error('[Dashboard] `closeAfterFinish: true` cannot be used on an inline Dashboard, because an inline Dashboard cannot be closed at all. Either set `inline: false`, or disable the `closeAfterFinish` option.');
          }

          var allowMultipleUploads = _this.uppy.opts.allowMultipleUploads;

          if (allowMultipleUploads && closeAfterFinish) {
            _this.uppy.log('[Dashboard] When using `closeAfterFinish`, we recommended setting the `allowMultipleUploads` option to `false` in the Uppy constructor. See https://uppy.io/docs/uppy/#allowMultipleUploads-true', 'warning');
          }

          var target = _this.opts.target;

          if (target) {
            _this.mount(target, _assertThisInitialized$1(_this));
          }

          var plugins = _this.opts.plugins || [];
          plugins.forEach(function (pluginID) {
            var plugin = _this.uppy.getPlugin(pluginID);

            if (plugin) {
              plugin.mount(_assertThisInitialized$1(_this), plugin);
            }
          });

          if (!_this.opts.disableStatusBar) {
            _this.uppy.use(lib$2, {
              id: _this.id + ":StatusBar",
              target: _assertThisInitialized$1(_this),
              hideUploadButton: _this.opts.hideUploadButton,
              hideRetryButton: _this.opts.hideRetryButton,
              hidePauseResumeButton: _this.opts.hidePauseResumeButton,
              hideCancelButton: _this.opts.hideCancelButton,
              showProgressDetails: _this.opts.showProgressDetails,
              hideAfterFinish: _this.opts.hideProgressAfterFinish,
              locale: _this.opts.locale,
              doneButtonHandler: _this.opts.doneButtonHandler
            });
          }

          if (!_this.opts.disableInformer) {
            _this.uppy.use(lib$3, {
              id: _this.id + ":Informer",
              target: _assertThisInitialized$1(_this)
            });
          }

          if (!_this.opts.disableThumbnailGenerator) {
            _this.uppy.use(lib$4, {
              id: _this.id + ":ThumbnailGenerator",
              thumbnailWidth: _this.opts.thumbnailWidth,
              thumbnailType: _this.opts.thumbnailType,
              waitForThumbnailsBeforeUpload: _this.opts.waitForThumbnailsBeforeUpload,
              // If we don't block on thumbnails, we can lazily generate them
              lazy: !_this.opts.waitForThumbnailsBeforeUpload
            });
          } // Dark Mode / theme


          _this.darkModeMediaQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
          var isDarkModeOnFromTheStart = _this.darkModeMediaQuery ? _this.darkModeMediaQuery.matches : false;

          _this.uppy.log("[Dashboard] Dark mode is " + (isDarkModeOnFromTheStart ? 'on' : 'off'));

          _this.setDarkModeCapability(isDarkModeOnFromTheStart);

          if (_this.opts.theme === 'auto') {
            _this.darkModeMediaQuery.addListener(_this.handleSystemDarkModeChange);
          }

          _this.discoverProviderPlugins();

          _this.initEvents();
        };

        _this.uninstall = function () {
          if (!_this.opts.disableInformer) {
            var informer = _this.uppy.getPlugin(_this.id + ":Informer"); // Checking if this plugin exists, in case it was removed by uppy-core
            // before the Dashboard was.


            if (informer) _this.uppy.removePlugin(informer);
          }

          if (!_this.opts.disableStatusBar) {
            var statusBar = _this.uppy.getPlugin(_this.id + ":StatusBar");

            if (statusBar) _this.uppy.removePlugin(statusBar);
          }

          if (!_this.opts.disableThumbnailGenerator) {
            var thumbnail = _this.uppy.getPlugin(_this.id + ":ThumbnailGenerator");

            if (thumbnail) _this.uppy.removePlugin(thumbnail);
          }

          var plugins = _this.opts.plugins || [];
          plugins.forEach(function (pluginID) {
            var plugin = _this.uppy.getPlugin(pluginID);

            if (plugin) plugin.unmount();
          });

          if (_this.opts.theme === 'auto') {
            _this.darkModeMediaQuery.removeListener(_this.handleSystemDarkModeChange);
          }

          _this.unmount();

          _this.removeEvents();
        };

        _this.id = _this.opts.id || 'Dashboard';
        _this.title = 'Dashboard';
        _this.type = 'orchestrator';
        _this.modalName = "uppy-Dashboard-" + cuid_1();
        _this.defaultLocale = {
          strings: {
            closeModal: 'Close Modal',
            importFrom: 'Import from %{name}',
            addingMoreFiles: 'Adding more files',
            addMoreFiles: 'Add more files',
            dashboardWindowTitle: 'File Uploader Window (Press escape to close)',
            dashboardTitle: 'File Uploader',
            copyLinkToClipboardSuccess: 'Link copied to clipboard',
            copyLinkToClipboardFallback: 'Copy the URL below',
            copyLink: 'Copy link',
            fileSource: 'File source: %{name}',
            done: 'Done',
            back: 'Back',
            addMore: 'Add more',
            removeFile: 'Remove file',
            editFile: 'Edit file',
            editing: 'Editing %{file}',
            finishEditingFile: 'Finish editing file',
            saveChanges: 'Save changes',
            cancel: 'Cancel',
            myDevice: 'My Device',
            dropPasteFiles: 'Drop files here or %{browseFiles}',
            dropPasteFolders: 'Drop files here or %{browseFolders}',
            dropPasteBoth: 'Drop files here, %{browseFiles} or %{browseFolders}',
            dropPasteImportFiles: 'Drop files here, %{browseFiles} or import from:',
            dropPasteImportFolders: 'Drop files here, %{browseFolders} or import from:',
            dropPasteImportBoth: 'Drop files here, %{browseFiles}, %{browseFolders} or import from:',
            importFiles: 'Import files from:',
            dropHint: 'Drop your files here',
            browseFiles: 'browse files',
            browseFolders: 'browse folders',
            uploadComplete: 'Upload complete',
            uploadPaused: 'Upload paused',
            resumeUpload: 'Resume upload',
            pauseUpload: 'Pause upload',
            retryUpload: 'Retry upload',
            cancelUpload: 'Cancel upload',
            xFilesSelected: {
              0: '%{smart_count} file selected',
              1: '%{smart_count} files selected'
            },
            uploadingXFiles: {
              0: 'Uploading %{smart_count} file',
              1: 'Uploading %{smart_count} files'
            },
            processingXFiles: {
              0: 'Processing %{smart_count} file',
              1: 'Processing %{smart_count} files'
            },
            // The default `poweredBy2` string only combines the `poweredBy` string (%{backwardsCompat}) with the size.
            // Locales can override `poweredBy2` to specify a different word order. This is for backwards compat with
            // Uppy 1.9.x and below which did a naive concatenation of `poweredBy2 + size` instead of using a locale-specific
            // substitution.
            // TODO: In 2.0 `poweredBy2` should be removed in and `poweredBy` updated to use substitution.
            poweredBy2: '%{backwardsCompat} %{uppy}',
            poweredBy: 'Powered by'
          }
        }; // set default options

        var defaultOptions = {
          target: 'body',
          metaFields: [],
          trigger: '#uppy-select-files',
          inline: false,
          width: 750,
          height: 550,
          thumbnailWidth: 280,
          thumbnailType: 'image/jpeg',
          waitForThumbnailsBeforeUpload: false,
          defaultPickerIcon: defaultPickerIcon,
          showLinkToFileUploadResult: true,
          showProgressDetails: false,
          hideUploadButton: false,
          hideCancelButton: false,
          hideRetryButton: false,
          hidePauseResumeButton: false,
          hideProgressAfterFinish: false,
          doneButtonHandler: function doneButtonHandler() {
            _this.uppy.reset();

            _this.requestCloseModal();
          },
          note: null,
          closeModalOnClickOutside: false,
          closeAfterFinish: false,
          disableStatusBar: false,
          disableInformer: false,
          disableThumbnailGenerator: false,
          disablePageScrollWhenModalOpen: true,
          animateOpenClose: true,
          fileManagerSelectionType: 'files',
          proudlyDisplayPoweredByUppy: true,
          onRequestCloseModal: function onRequestCloseModal() {
            return _this.closeModal();
          },
          showSelectedFiles: true,
          showRemoveButtonAfterComplete: false,
          browserBackButtonClose: false,
          theme: 'light',
          autoOpenFileEditor: false,
          disabled: false,
          disableLocalFiles: false
        }; // merge default options with the ones set by user

        _this.opts = _extends$c({}, defaultOptions, _opts);

        _this.i18nInit();

        _this.superFocus = createSuperFocus();
        _this.ifFocusedOnUppyRecently = false; // Timeouts

        _this.makeDashboardInsidesVisibleAnywayTimeout = null;
        _this.removeDragOverClassTimeout = null;
        return _this;
      }

      var _proto = Dashboard$1.prototype;

      _proto.onMount = function onMount() {
        // Set the text direction if the page has not defined one.
        var element = this.el;
        var direction = getTextDirection_1(element);

        if (!direction) {
          element.dir = 'ltr';
        }
      };

      return Dashboard$1;
    }(Plugin$4), _class$3.VERSION = "1.19.1", _temp$3);

    /* node_modules\@uppy\svelte\src\components\DashboardModal.svelte generated by Svelte v3.30.1 */

    const { Object: Object_1 } = globals;
    const file = "node_modules\\@uppy\\svelte\\src\\components\\DashboardModal.svelte";

    function create_fragment(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			add_location(div, file, 36, 0, 1040);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			/*div_binding*/ ctx[7](div);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			/*div_binding*/ ctx[7](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("DashboardModal", slots, []);
    	
    	let container;
    	let plugin;
    	let { uppy } = $$props;
    	let { props = {} } = $$props;
    	let { open } = $$props;
    	let lastOpen = open;
    	let { plugins = [] } = $$props;

    	const installPlugin = () => {
    		const options = Object.assign(Object.assign({ id: "svelte:DashboardModal", plugins }, props), { target: container });
    		uppy.use(lib$5, options);
    		$$invalidate(5, plugin = uppy.getPlugin(options.id));
    		if (open) plugin.openModal();
    	};

    	const uninstallPlugin = (uppyInstance = uppy) => {
    		uppyInstance.removePlugin(plugin);
    	};

    	onMount(() => installPlugin());
    	onDestroy(() => uninstallPlugin());
    	const writable_props = ["uppy", "props", "open", "plugins"];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<DashboardModal> was created with unknown prop '${key}'`);
    	});

    	function div_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			container = $$value;
    			$$invalidate(0, container);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ("uppy" in $$props) $$invalidate(1, uppy = $$props.uppy);
    		if ("props" in $$props) $$invalidate(2, props = $$props.props);
    		if ("open" in $$props) $$invalidate(3, open = $$props.open);
    		if ("plugins" in $$props) $$invalidate(4, plugins = $$props.plugins);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		onDestroy,
    		DashboardPlugin: lib$5,
    		container,
    		plugin,
    		uppy,
    		props,
    		open,
    		lastOpen,
    		plugins,
    		installPlugin,
    		uninstallPlugin
    	});

    	$$self.$inject_state = $$props => {
    		if ("container" in $$props) $$invalidate(0, container = $$props.container);
    		if ("plugin" in $$props) $$invalidate(5, plugin = $$props.plugin);
    		if ("uppy" in $$props) $$invalidate(1, uppy = $$props.uppy);
    		if ("props" in $$props) $$invalidate(2, props = $$props.props);
    		if ("open" in $$props) $$invalidate(3, open = $$props.open);
    		if ("lastOpen" in $$props) $$invalidate(6, lastOpen = $$props.lastOpen);
    		if ("plugins" in $$props) $$invalidate(4, plugins = $$props.plugins);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*plugins, props, container, uppy*/ 23) {
    			 {
    				const options = Object.assign(Object.assign({ id: "svelte:DashboardModal", plugins }, props), { target: container });
    				uppy.setOptions(options);
    			}
    		}

    		if ($$self.$$.dirty & /*open, lastOpen, plugin*/ 104) {
    			 {
    				if (open && !lastOpen) {
    					plugin.openModal();
    				}

    				if (!open && lastOpen) {
    					plugin.closeModal();
    				}

    				$$invalidate(6, lastOpen = open);
    			}
    		}
    	};

    	return [container, uppy, props, open, plugins, plugin, lastOpen, div_binding];
    }

    class DashboardModal extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { uppy: 1, props: 2, open: 3, plugins: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "DashboardModal",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*uppy*/ ctx[1] === undefined && !("uppy" in props)) {
    			console.warn("<DashboardModal> was created without expected prop 'uppy'");
    		}

    		if (/*open*/ ctx[3] === undefined && !("open" in props)) {
    			console.warn("<DashboardModal> was created without expected prop 'open'");
    		}
    	}

    	get uppy() {
    		throw new Error("<DashboardModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set uppy(value) {
    		throw new Error("<DashboardModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get props() {
    		throw new Error("<DashboardModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set props(value) {
    		throw new Error("<DashboardModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get open() {
    		throw new Error("<DashboardModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set open(value) {
    		throw new Error("<DashboardModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get plugins() {
    		throw new Error("<DashboardModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set plugins(value) {
    		throw new Error("<DashboardModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var _class$4, _temp$4;

    function _extends$d() { _extends$d = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$d.apply(this, arguments); }

    function _assertThisInitialized$2(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _inheritsLoose$a(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; _setPrototypeOf$a(subClass, superClass); }

    function _setPrototypeOf$a(o, p) { _setPrototypeOf$a = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$a(o, p); }

    var Plugin$5 = lib$1.Plugin;









    var h$k = _require2.h;
    /**
     * Drag & Drop plugin
     *
     */


    var lib$6 = (_temp$4 = _class$4 = /*#__PURE__*/function (_Plugin) {
      _inheritsLoose$a(DragDrop, _Plugin);

      function DragDrop(uppy, opts) {
        var _this;

        _this = _Plugin.call(this, uppy, opts) || this;
        _this.type = 'acquirer';
        _this.id = _this.opts.id || 'DragDrop';
        _this.title = 'Drag & Drop';
        _this.defaultLocale = {
          strings: {
            dropHereOr: 'Drop files here or %{browse}',
            browse: 'browse'
          }
        }; // Default options

        var defaultOpts = {
          target: null,
          inputName: 'files[]',
          width: '100%',
          height: '100%',
          note: null
        }; // Merge default options with the ones set by user

        _this.opts = _extends$d({}, defaultOpts, opts); // Check for browser dragDrop support

        _this.isDragDropSupported = isDragDropSupported();
        _this.removeDragOverClassTimeout = null;

        _this.i18nInit(); // Bind `this` to class methods


        _this.onInputChange = _this.onInputChange.bind(_assertThisInitialized$2(_this));
        _this.handleDragOver = _this.handleDragOver.bind(_assertThisInitialized$2(_this));
        _this.handleDragLeave = _this.handleDragLeave.bind(_assertThisInitialized$2(_this));
        _this.handleDrop = _this.handleDrop.bind(_assertThisInitialized$2(_this));
        _this.addFiles = _this.addFiles.bind(_assertThisInitialized$2(_this));
        _this.render = _this.render.bind(_assertThisInitialized$2(_this));
        return _this;
      }

      var _proto = DragDrop.prototype;

      _proto.setOptions = function setOptions(newOpts) {
        _Plugin.prototype.setOptions.call(this, newOpts);

        this.i18nInit();
      };

      _proto.i18nInit = function i18nInit() {
        this.translator = new Translator([this.defaultLocale, this.uppy.locale, this.opts.locale]);
        this.i18n = this.translator.translate.bind(this.translator);
        this.i18nArray = this.translator.translateArray.bind(this.translator);
        this.setPluginState(); // so that UI re-renders and we see the updated locale
      };

      _proto.addFiles = function addFiles(files) {
        var _this2 = this;

        var descriptors = files.map(function (file) {
          return {
            source: _this2.id,
            name: file.name,
            type: file.type,
            data: file,
            meta: {
              // path of the file relative to the ancestor directory the user selected.
              // e.g. 'docs/Old Prague/airbnb.pdf'
              relativePath: file.relativePath || null
            }
          };
        });

        try {
          this.uppy.addFiles(descriptors);
        } catch (err) {
          this.uppy.log(err);
        }
      };

      _proto.onInputChange = function onInputChange(event) {
        this.uppy.log('[DragDrop] Files selected through input');
        var files = toArray(event.target.files);
        this.addFiles(files); // We clear the input after a file is selected, because otherwise
        // change event is not fired in Chrome and Safari when a file
        // with the same name is selected.
        // ___Why not use value="" on <input/> instead?
        //    Because if we use that method of clearing the input,
        //    Chrome will not trigger change if we drop the same file twice (Issue #768).

        event.target.value = null;
      };

      _proto.handleDrop = function handleDrop(event, dropCategory) {
        var _this3 = this;

        event.preventDefault();
        event.stopPropagation();
        clearTimeout(this.removeDragOverClassTimeout); // 2. Remove dragover class

        this.setPluginState({
          isDraggingOver: false
        }); // 3. Add all dropped files

        this.uppy.log('[DragDrop] Files were dropped');

        var logDropError = function logDropError(error) {
          _this3.uppy.log(error, 'error');
        };

        getDroppedFiles(event.dataTransfer, {
          logDropError: logDropError
        }).then(function (files) {
          return _this3.addFiles(files);
        });
      };

      _proto.handleDragOver = function handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation(); // 1. Add a small (+) icon on drop
        // (and prevent browsers from interpreting this as files being _moved_ into the browser, https://github.com/transloadit/uppy/issues/1978)

        event.dataTransfer.dropEffect = 'copy';
        clearTimeout(this.removeDragOverClassTimeout);
        this.setPluginState({
          isDraggingOver: true
        });
      };

      _proto.handleDragLeave = function handleDragLeave(event) {
        var _this4 = this;

        event.preventDefault();
        event.stopPropagation();
        clearTimeout(this.removeDragOverClassTimeout); // Timeout against flickering, this solution is taken from drag-drop library. Solution with 'pointer-events: none' didn't work across browsers.

        this.removeDragOverClassTimeout = setTimeout(function () {
          _this4.setPluginState({
            isDraggingOver: false
          });
        }, 50);
      };

      _proto.renderHiddenFileInput = function renderHiddenFileInput() {
        var _this5 = this;

        var restrictions = this.uppy.opts.restrictions;
        return h$k("input", {
          className: "uppy-DragDrop-input",
          type: "file",
          hidden: true,
          ref: function ref(_ref) {
            _this5.fileInputRef = _ref;
          },
          name: this.opts.inputName,
          multiple: restrictions.maxNumberOfFiles !== 1,
          accept: restrictions.allowedFileTypes,
          onChange: this.onInputChange
        });
      };

      _proto.renderArrowSvg = function renderArrowSvg() {
        return h$k("svg", {
          "aria-hidden": "true",
          focusable: "false",
          className: "uppy-c-icon uppy-DragDrop-arrow",
          width: "16",
          height: "16",
          viewBox: "0 0 16 16"
        }, h$k("path", {
          d: "M11 10V0H5v10H2l6 6 6-6h-3zm0 0",
          fillRule: "evenodd"
        }));
      };

      _proto.renderLabel = function renderLabel() {
        return h$k("div", {
          className: "uppy-DragDrop-label"
        }, this.i18nArray('dropHereOr', {
          browse: h$k("span", {
            className: "uppy-DragDrop-browse"
          }, this.i18n('browse'))
        }));
      };

      _proto.renderNote = function renderNote() {
        return h$k("span", {
          className: "uppy-DragDrop-note"
        }, this.opts.note);
      };

      _proto.render = function render(state) {
        var _this6 = this;

        var dragDropClass = "uppy-Root\n      uppy-u-reset\n      uppy-DragDrop-container\n      " + (this.isDragDropSupported ? 'uppy-DragDrop--isDragDropSupported' : '') + "\n      " + (this.getPluginState().isDraggingOver ? 'uppy-DragDrop--isDraggingOver' : '') + "\n    ";
        var dragDropStyle = {
          width: this.opts.width,
          height: this.opts.height
        };
        return h$k("button", {
          type: "button",
          className: dragDropClass,
          style: dragDropStyle,
          onClick: function onClick() {
            return _this6.fileInputRef.click();
          },
          onDragOver: this.handleDragOver,
          onDragLeave: this.handleDragLeave,
          onDrop: this.handleDrop
        }, this.renderHiddenFileInput(), h$k("div", {
          className: "uppy-DragDrop-inner"
        }, this.renderArrowSvg(), this.renderLabel(), this.renderNote()));
      };

      _proto.install = function install() {
        this.setPluginState({
          isDraggingOver: false
        });
        var target = this.opts.target;

        if (target) {
          this.mount(target, this);
        }
      };

      _proto.uninstall = function uninstall() {
        this.unmount();
      };

      return DragDrop;
    }(Plugin$5), _class$4.VERSION = "1.4.27", _temp$4);

    var _class$5, _temp$5;

    function _extends$e() { _extends$e = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$e.apply(this, arguments); }

    function _assertThisInitialized$3(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _inheritsLoose$b(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; _setPrototypeOf$b(subClass, superClass); }

    function _setPrototypeOf$b(o, p) { _setPrototypeOf$b = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$b(o, p); }

    var Plugin$6 = lib$1.Plugin;

    var h$l = _require2.h;
    /**
     * Progress bar
     *
     */


    var lib$7 = (_temp$5 = _class$5 = /*#__PURE__*/function (_Plugin) {
      _inheritsLoose$b(ProgressBar, _Plugin);

      function ProgressBar(uppy, opts) {
        var _this;

        _this = _Plugin.call(this, uppy, opts) || this;
        _this.id = _this.opts.id || 'ProgressBar';
        _this.title = 'Progress Bar';
        _this.type = 'progressindicator'; // set default options

        var defaultOptions = {
          target: 'body',
          replaceTargetContent: false,
          fixed: false,
          hideAfterFinish: true
        }; // merge default options with the ones set by user

        _this.opts = _extends$e({}, defaultOptions, opts);
        _this.render = _this.render.bind(_assertThisInitialized$3(_this));
        return _this;
      }

      var _proto = ProgressBar.prototype;

      _proto.render = function render(state) {
        var progress = state.totalProgress || 0; // before starting and after finish should be hidden if specified in the options

        var isHidden = (progress === 0 || progress === 100) && this.opts.hideAfterFinish;
        return h$l("div", {
          className: "uppy uppy-ProgressBar",
          style: {
            position: this.opts.fixed ? 'fixed' : 'initial'
          },
          "aria-hidden": isHidden
        }, h$l("div", {
          className: "uppy-ProgressBar-inner",
          style: {
            width: progress + "%"
          }
        }), h$l("div", {
          className: "uppy-ProgressBar-percentage"
        }, progress));
      };

      _proto.install = function install() {
        var target = this.opts.target;

        if (target) {
          this.mount(target, this);
        }
      };

      _proto.uninstall = function uninstall() {
        this.unmount();
      };

      return ProgressBar;
    }(Plugin$6), _class$5.VERSION = "1.3.27", _temp$5);

    function _inheritsLoose$c(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; _setPrototypeOf$c(subClass, superClass); }

    function _wrapNativeSuper$1(Class) { var _cache = typeof Map === "function" ? new Map() : undefined; _wrapNativeSuper$1 = function _wrapNativeSuper(Class) { if (Class === null || !_isNativeFunction$1(Class)) return Class; if (typeof Class !== "function") { throw new TypeError("Super expression must either be null or a function"); } if (typeof _cache !== "undefined") { if (_cache.has(Class)) return _cache.get(Class); _cache.set(Class, Wrapper); } function Wrapper() { return _construct$1(Class, arguments, _getPrototypeOf$1(this).constructor); } Wrapper.prototype = Object.create(Class.prototype, { constructor: { value: Wrapper, enumerable: false, writable: true, configurable: true } }); return _setPrototypeOf$c(Wrapper, Class); }; return _wrapNativeSuper$1(Class); }

    function _construct$1(Parent, args, Class) { if (_isNativeReflectConstruct$1()) { _construct$1 = Reflect.construct; } else { _construct$1 = function _construct(Parent, args, Class) { var a = [null]; a.push.apply(a, args); var Constructor = Function.bind.apply(Parent, a); var instance = new Constructor(); if (Class) _setPrototypeOf$c(instance, Class.prototype); return instance; }; } return _construct$1.apply(null, arguments); }

    function _isNativeReflectConstruct$1() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _isNativeFunction$1(fn) { return Function.toString.call(fn).indexOf("[native code]") !== -1; }

    function _setPrototypeOf$c(o, p) { _setPrototypeOf$c = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$c(o, p); }

    function _getPrototypeOf$1(o) { _getPrototypeOf$1 = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$1(o); }

    var AuthError = /*#__PURE__*/function (_Error) {
      _inheritsLoose$c(AuthError, _Error);

      function AuthError() {
        var _this;

        _this = _Error.call(this, 'Authorization required') || this;
        _this.name = 'AuthError';
        _this.isAuthError = true;
        return _this;
      }

      return AuthError;
    }( /*#__PURE__*/_wrapNativeSuper$1(Error));

    var AuthError_1 = AuthError;

    function _inheritsLoose$d(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; _setPrototypeOf$d(subClass, superClass); }

    function _wrapNativeSuper$2(Class) { var _cache = typeof Map === "function" ? new Map() : undefined; _wrapNativeSuper$2 = function _wrapNativeSuper(Class) { if (Class === null || !_isNativeFunction$2(Class)) return Class; if (typeof Class !== "function") { throw new TypeError("Super expression must either be null or a function"); } if (typeof _cache !== "undefined") { if (_cache.has(Class)) return _cache.get(Class); _cache.set(Class, Wrapper); } function Wrapper() { return _construct$2(Class, arguments, _getPrototypeOf$2(this).constructor); } Wrapper.prototype = Object.create(Class.prototype, { constructor: { value: Wrapper, enumerable: false, writable: true, configurable: true } }); return _setPrototypeOf$d(Wrapper, Class); }; return _wrapNativeSuper$2(Class); }

    function _construct$2(Parent, args, Class) { if (_isNativeReflectConstruct$2()) { _construct$2 = Reflect.construct; } else { _construct$2 = function _construct(Parent, args, Class) { var a = [null]; a.push.apply(a, args); var Constructor = Function.bind.apply(Parent, a); var instance = new Constructor(); if (Class) _setPrototypeOf$d(instance, Class.prototype); return instance; }; } return _construct$2.apply(null, arguments); }

    function _isNativeReflectConstruct$2() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _isNativeFunction$2(fn) { return Function.toString.call(fn).indexOf("[native code]") !== -1; }

    function _setPrototypeOf$d(o, p) { _setPrototypeOf$d = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$d(o, p); }

    function _getPrototypeOf$2(o) { _getPrototypeOf$2 = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$2(o); }

    var NetworkError = /*#__PURE__*/function (_Error) {
      _inheritsLoose$d(NetworkError, _Error);

      function NetworkError(error, xhr) {
        var _this;

        if (xhr === void 0) {
          xhr = null;
        }

        _this = _Error.call(this, "This looks like a network error, the endpoint might be blocked by an internet provider or a firewall.\n\nSource error: [" + error + "]") || this;
        _this.isNetworkError = true;
        _this.request = xhr;
        return _this;
      }

      return NetworkError;
    }( /*#__PURE__*/_wrapNativeSuper$2(Error));

    var NetworkError_1 = NetworkError;

    /**
     * Wrapper around window.fetch that throws a NetworkError when appropriate
     */


    var fetchWithNetworkError = function fetchWithNetworkError() {
      return fetch.apply(void 0, arguments).catch(function (err) {
        if (err.name === 'AbortError') {
          throw err;
        } else {
          throw new NetworkError_1(err);
        }
      });
    };

    var _class$6, _temp$6;

    function _extends$f() { _extends$f = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$f.apply(this, arguments); }

    function _defineProperties$1(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$1(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$1(Constructor.prototype, protoProps); if (staticProps) _defineProperties$1(Constructor, staticProps); return Constructor; }



     // Remove the trailing slash so we can always safely append /xyz.


    function stripSlash(url) {
      return url.replace(/\/$/, '');
    }

    var RequestClient = (_temp$6 = _class$6 = /*#__PURE__*/function () {
      function RequestClient(uppy, opts) {
        this.uppy = uppy;
        this.opts = opts;
        this.onReceiveResponse = this.onReceiveResponse.bind(this);
        this.allowedHeaders = ['accept', 'content-type', 'uppy-auth-token'];
        this.preflightDone = false;
      }

      var _proto = RequestClient.prototype;

      _proto.headers = function headers() {
        var userHeaders = this.opts.companionHeaders || this.opts.serverHeaders || {};
        return Promise.resolve(_extends$f({}, this.defaultHeaders, userHeaders));
      };

      _proto._getPostResponseFunc = function _getPostResponseFunc(skip) {
        var _this = this;

        return function (response) {
          if (!skip) {
            return _this.onReceiveResponse(response);
          }

          return response;
        };
      };

      _proto.onReceiveResponse = function onReceiveResponse(response) {
        var state = this.uppy.getState();
        var companion = state.companion || {};
        var host = this.opts.companionUrl;
        var headers = response.headers; // Store the self-identified domain name for the Companion instance we just hit.

        if (headers.has('i-am') && headers.get('i-am') !== companion[host]) {
          var _extends2;

          this.uppy.setState({
            companion: _extends$f({}, companion, (_extends2 = {}, _extends2[host] = headers.get('i-am'), _extends2))
          });
        }

        return response;
      };

      _proto._getUrl = function _getUrl(url) {
        if (/^(https?:|)\/\//.test(url)) {
          return url;
        }

        return this.hostname + "/" + url;
      };

      _proto._json = function _json(res) {
        if (res.status === 401) {
          throw new AuthError_1();
        }

        if (res.status < 200 || res.status > 300) {
          var errMsg = "Failed request with status: " + res.status + ". " + res.statusText;
          return res.json().then(function (errData) {
            errMsg = errData.message ? errMsg + " message: " + errData.message : errMsg;
            errMsg = errData.requestId ? errMsg + " request-Id: " + errData.requestId : errMsg;
            throw new Error(errMsg);
          }).catch(function () {
            throw new Error(errMsg);
          });
        }

        return res.json();
      };

      _proto.preflight = function preflight(path) {
        var _this2 = this;

        if (this.preflightDone) {
          return Promise.resolve(this.allowedHeaders.slice());
        }

        return fetch(this._getUrl(path), {
          method: 'OPTIONS'
        }).then(function (response) {
          if (response.headers.has('access-control-allow-headers')) {
            _this2.allowedHeaders = response.headers.get('access-control-allow-headers').split(',').map(function (headerName) {
              return headerName.trim().toLowerCase();
            });
          }

          _this2.preflightDone = true;
          return _this2.allowedHeaders.slice();
        }).catch(function (err) {
          _this2.uppy.log("[CompanionClient] unable to make preflight request " + err, 'warning');

          _this2.preflightDone = true;
          return _this2.allowedHeaders.slice();
        });
      };

      _proto.preflightAndHeaders = function preflightAndHeaders(path) {
        var _this3 = this;

        return Promise.all([this.preflight(path), this.headers()]).then(function (_ref) {
          var allowedHeaders = _ref[0],
              headers = _ref[1];
          // filter to keep only allowed Headers
          Object.keys(headers).forEach(function (header) {
            if (allowedHeaders.indexOf(header.toLowerCase()) === -1) {
              _this3.uppy.log("[CompanionClient] excluding unallowed header " + header);

              delete headers[header];
            }
          });
          return headers;
        });
      };

      _proto.get = function get(path, skipPostResponse) {
        var _this4 = this;

        return this.preflightAndHeaders(path).then(function (headers) {
          return fetchWithNetworkError(_this4._getUrl(path), {
            method: 'get',
            headers: headers,
            credentials: _this4.opts.companionCookiesRule || 'same-origin'
          });
        }).then(this._getPostResponseFunc(skipPostResponse)).then(function (res) {
          return _this4._json(res);
        }).catch(function (err) {
          err = err.isAuthError ? err : new Error("Could not get " + _this4._getUrl(path) + ". " + err);
          return Promise.reject(err);
        });
      };

      _proto.post = function post(path, data, skipPostResponse) {
        var _this5 = this;

        return this.preflightAndHeaders(path).then(function (headers) {
          return fetchWithNetworkError(_this5._getUrl(path), {
            method: 'post',
            headers: headers,
            credentials: _this5.opts.companionCookiesRule || 'same-origin',
            body: JSON.stringify(data)
          });
        }).then(this._getPostResponseFunc(skipPostResponse)).then(function (res) {
          return _this5._json(res);
        }).catch(function (err) {
          err = err.isAuthError ? err : new Error("Could not post " + _this5._getUrl(path) + ". " + err);
          return Promise.reject(err);
        });
      };

      _proto.delete = function _delete(path, data, skipPostResponse) {
        var _this6 = this;

        return this.preflightAndHeaders(path).then(function (headers) {
          return fetchWithNetworkError(_this6.hostname + "/" + path, {
            method: 'delete',
            headers: headers,
            credentials: _this6.opts.companionCookiesRule || 'same-origin',
            body: data ? JSON.stringify(data) : null
          });
        }).then(this._getPostResponseFunc(skipPostResponse)).then(function (res) {
          return _this6._json(res);
        }).catch(function (err) {
          err = err.isAuthError ? err : new Error("Could not delete " + _this6._getUrl(path) + ". " + err);
          return Promise.reject(err);
        });
      };

      _createClass$1(RequestClient, [{
        key: "hostname",
        get: function get() {
          var _this$uppy$getState = this.uppy.getState(),
              companion = _this$uppy$getState.companion;

          var host = this.opts.companionUrl;
          return stripSlash(companion && companion[host] ? companion[host] : host);
        }
      }, {
        key: "defaultHeaders",
        get: function get() {
          return {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'Uppy-Versions': "@uppy/companion-client=" + RequestClient.VERSION
          };
        }
      }]);

      return RequestClient;
    }(), _class$6.VERSION = "1.9.0", _temp$6);

    var has = Object.prototype.hasOwnProperty;

    /**
     * Stringify an object for use in a query string.
     *
     * @param {Object} obj - The object.
     * @param {string} prefix - When nesting, the parent key.
     *     keys in `obj` will be stringified as `prefix[key]`.
     * @returns {string}
     */

    var qsStringify = function queryStringify (obj, prefix) {
      var pairs = [];
      for (var key in obj) {
        if (!has.call(obj, key)) {
          continue
        }

        var value = obj[key];
        var enkey = encodeURIComponent(key);
        var pair;
        if (typeof value === 'object') {
          pair = queryStringify(value, prefix ? prefix + '[' + enkey + ']' : enkey);
        } else {
          pair = (prefix ? prefix + '[' + enkey + ']' : enkey) + '=' + encodeURIComponent(value);
        }
        pairs.push(pair);
      }
      return pairs.join('&')
    };

    /**
     * Check if we're required to add a port number.
     *
     * @see https://url.spec.whatwg.org/#default-port
     * @param {Number|String} port Port number we need to check
     * @param {String} protocol Protocol we need to check against.
     * @returns {Boolean} Is it a default port for the given protocol
     * @api private
     */
    var requiresPort = function required(port, protocol) {
      protocol = protocol.split(':')[0];
      port = +port;

      if (!port) return false;

      switch (protocol) {
        case 'http':
        case 'ws':
        return port !== 80;

        case 'https':
        case 'wss':
        return port !== 443;

        case 'ftp':
        return port !== 21;

        case 'gopher':
        return port !== 70;

        case 'file':
        return false;
      }

      return port !== 0;
    };

    var has$1 = Object.prototype.hasOwnProperty
      , undef;

    /**
     * Decode a URI encoded string.
     *
     * @param {String} input The URI encoded string.
     * @returns {String|Null} The decoded string.
     * @api private
     */
    function decode(input) {
      try {
        return decodeURIComponent(input.replace(/\+/g, ' '));
      } catch (e) {
        return null;
      }
    }

    /**
     * Attempts to encode a given input.
     *
     * @param {String} input The string that needs to be encoded.
     * @returns {String|Null} The encoded string.
     * @api private
     */
    function encode(input) {
      try {
        return encodeURIComponent(input);
      } catch (e) {
        return null;
      }
    }

    /**
     * Simple query string parser.
     *
     * @param {String} query The query string that needs to be parsed.
     * @returns {Object}
     * @api public
     */
    function querystring(query) {
      var parser = /([^=?#&]+)=?([^&]*)/g
        , result = {}
        , part;

      while (part = parser.exec(query)) {
        var key = decode(part[1])
          , value = decode(part[2]);

        //
        // Prevent overriding of existing properties. This ensures that build-in
        // methods like `toString` or __proto__ are not overriden by malicious
        // querystrings.
        //
        // In the case if failed decoding, we want to omit the key/value pairs
        // from the result.
        //
        if (key === null || value === null || key in result) continue;
        result[key] = value;
      }

      return result;
    }

    /**
     * Transform a query string to an object.
     *
     * @param {Object} obj Object that should be transformed.
     * @param {String} prefix Optional prefix.
     * @returns {String}
     * @api public
     */
    function querystringify(obj, prefix) {
      prefix = prefix || '';

      var pairs = []
        , value
        , key;

      //
      // Optionally prefix with a '?' if needed
      //
      if ('string' !== typeof prefix) prefix = '?';

      for (key in obj) {
        if (has$1.call(obj, key)) {
          value = obj[key];

          //
          // Edge cases where we actually want to encode the value to an empty
          // string instead of the stringified value.
          //
          if (!value && (value === null || value === undef || isNaN(value))) {
            value = '';
          }

          key = encode(key);
          value = encode(value);

          //
          // If we failed to encode the strings, we should bail out as we don't
          // want to add invalid strings to the query.
          //
          if (key === null || value === null) continue;
          pairs.push(key +'='+ value);
        }
      }

      return pairs.length ? prefix + pairs.join('&') : '';
    }

    //
    // Expose the module.
    //
    var stringify = querystringify;
    var parse = querystring;

    var querystringify_1 = {
    	stringify: stringify,
    	parse: parse
    };

    var slashes = /^[A-Za-z][A-Za-z0-9+-.]*:[\\/]+/
      , protocolre = /^([a-z][a-z0-9.+-]*:)?([\\/]{1,})?([\S\s]*)/i
      , whitespace = '[\\x09\\x0A\\x0B\\x0C\\x0D\\x20\\xA0\\u1680\\u180E\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200A\\u202F\\u205F\\u3000\\u2028\\u2029\\uFEFF]'
      , left = new RegExp('^'+ whitespace +'+');

    /**
     * Trim a given string.
     *
     * @param {String} str String to trim.
     * @public
     */
    function trimLeft(str) {
      return (str ? str : '').toString().replace(left, '');
    }

    /**
     * These are the parse rules for the URL parser, it informs the parser
     * about:
     *
     * 0. The char it Needs to parse, if it's a string it should be done using
     *    indexOf, RegExp using exec and NaN means set as current value.
     * 1. The property we should set when parsing this value.
     * 2. Indication if it's backwards or forward parsing, when set as number it's
     *    the value of extra chars that should be split off.
     * 3. Inherit from location if non existing in the parser.
     * 4. `toLowerCase` the resulting value.
     */
    var rules = [
      ['#', 'hash'],                        // Extract from the back.
      ['?', 'query'],                       // Extract from the back.
      function sanitize(address) {          // Sanitize what is left of the address
        return address.replace('\\', '/');
      },
      ['/', 'pathname'],                    // Extract from the back.
      ['@', 'auth', 1],                     // Extract from the front.
      [NaN, 'host', undefined, 1, 1],       // Set left over value.
      [/:(\d+)$/, 'port', undefined, 1],    // RegExp the back.
      [NaN, 'hostname', undefined, 1, 1]    // Set left over.
    ];

    /**
     * These properties should not be copied or inherited from. This is only needed
     * for all non blob URL's as a blob URL does not include a hash, only the
     * origin.
     *
     * @type {Object}
     * @private
     */
    var ignore = { hash: 1, query: 1 };

    /**
     * The location object differs when your code is loaded through a normal page,
     * Worker or through a worker using a blob. And with the blobble begins the
     * trouble as the location object will contain the URL of the blob, not the
     * location of the page where our code is loaded in. The actual origin is
     * encoded in the `pathname` so we can thankfully generate a good "default"
     * location from it so we can generate proper relative URL's again.
     *
     * @param {Object|String} loc Optional default location object.
     * @returns {Object} lolcation object.
     * @public
     */
    function lolcation(loc) {
      var globalVar;

      if (typeof window !== 'undefined') globalVar = window;
      else if (typeof commonjsGlobal !== 'undefined') globalVar = commonjsGlobal;
      else if (typeof self !== 'undefined') globalVar = self;
      else globalVar = {};

      var location = globalVar.location || {};
      loc = loc || location;

      var finaldestination = {}
        , type = typeof loc
        , key;

      if ('blob:' === loc.protocol) {
        finaldestination = new Url(unescape(loc.pathname), {});
      } else if ('string' === type) {
        finaldestination = new Url(loc, {});
        for (key in ignore) delete finaldestination[key];
      } else if ('object' === type) {
        for (key in loc) {
          if (key in ignore) continue;
          finaldestination[key] = loc[key];
        }

        if (finaldestination.slashes === undefined) {
          finaldestination.slashes = slashes.test(loc.href);
        }
      }

      return finaldestination;
    }

    /**
     * @typedef ProtocolExtract
     * @type Object
     * @property {String} protocol Protocol matched in the URL, in lowercase.
     * @property {Boolean} slashes `true` if protocol is followed by "//", else `false`.
     * @property {String} rest Rest of the URL that is not part of the protocol.
     */

    /**
     * Extract protocol information from a URL with/without double slash ("//").
     *
     * @param {String} address URL we want to extract from.
     * @return {ProtocolExtract} Extracted information.
     * @private
     */
    function extractProtocol(address) {
      address = trimLeft(address);

      var match = protocolre.exec(address)
        , protocol = match[1] ? match[1].toLowerCase() : ''
        , slashes = !!(match[2] && match[2].length >= 2)
        , rest =  match[2] && match[2].length === 1 ? '/' + match[3] : match[3];

      return {
        protocol: protocol,
        slashes: slashes,
        rest: rest
      };
    }

    /**
     * Resolve a relative URL pathname against a base URL pathname.
     *
     * @param {String} relative Pathname of the relative URL.
     * @param {String} base Pathname of the base URL.
     * @return {String} Resolved pathname.
     * @private
     */
    function resolve(relative, base) {
      if (relative === '') return base;

      var path = (base || '/').split('/').slice(0, -1).concat(relative.split('/'))
        , i = path.length
        , last = path[i - 1]
        , unshift = false
        , up = 0;

      while (i--) {
        if (path[i] === '.') {
          path.splice(i, 1);
        } else if (path[i] === '..') {
          path.splice(i, 1);
          up++;
        } else if (up) {
          if (i === 0) unshift = true;
          path.splice(i, 1);
          up--;
        }
      }

      if (unshift) path.unshift('');
      if (last === '.' || last === '..') path.push('');

      return path.join('/');
    }

    /**
     * The actual URL instance. Instead of returning an object we've opted-in to
     * create an actual constructor as it's much more memory efficient and
     * faster and it pleases my OCD.
     *
     * It is worth noting that we should not use `URL` as class name to prevent
     * clashes with the global URL instance that got introduced in browsers.
     *
     * @constructor
     * @param {String} address URL we want to parse.
     * @param {Object|String} [location] Location defaults for relative paths.
     * @param {Boolean|Function} [parser] Parser for the query string.
     * @private
     */
    function Url(address, location, parser) {
      address = trimLeft(address);

      if (!(this instanceof Url)) {
        return new Url(address, location, parser);
      }

      var relative, extracted, parse, instruction, index, key
        , instructions = rules.slice()
        , type = typeof location
        , url = this
        , i = 0;

      //
      // The following if statements allows this module two have compatibility with
      // 2 different API:
      //
      // 1. Node.js's `url.parse` api which accepts a URL, boolean as arguments
      //    where the boolean indicates that the query string should also be parsed.
      //
      // 2. The `URL` interface of the browser which accepts a URL, object as
      //    arguments. The supplied object will be used as default values / fall-back
      //    for relative paths.
      //
      if ('object' !== type && 'string' !== type) {
        parser = location;
        location = null;
      }

      if (parser && 'function' !== typeof parser) parser = querystringify_1.parse;

      location = lolcation(location);

      //
      // Extract protocol information before running the instructions.
      //
      extracted = extractProtocol(address || '');
      relative = !extracted.protocol && !extracted.slashes;
      url.slashes = extracted.slashes || relative && location.slashes;
      url.protocol = extracted.protocol || location.protocol || '';
      address = extracted.rest;

      //
      // When the authority component is absent the URL starts with a path
      // component.
      //
      if (!extracted.slashes) instructions[3] = [/(.*)/, 'pathname'];

      for (; i < instructions.length; i++) {
        instruction = instructions[i];

        if (typeof instruction === 'function') {
          address = instruction(address);
          continue;
        }

        parse = instruction[0];
        key = instruction[1];

        if (parse !== parse) {
          url[key] = address;
        } else if ('string' === typeof parse) {
          if (~(index = address.indexOf(parse))) {
            if ('number' === typeof instruction[2]) {
              url[key] = address.slice(0, index);
              address = address.slice(index + instruction[2]);
            } else {
              url[key] = address.slice(index);
              address = address.slice(0, index);
            }
          }
        } else if ((index = parse.exec(address))) {
          url[key] = index[1];
          address = address.slice(0, index.index);
        }

        url[key] = url[key] || (
          relative && instruction[3] ? location[key] || '' : ''
        );

        //
        // Hostname, host and protocol should be lowercased so they can be used to
        // create a proper `origin`.
        //
        if (instruction[4]) url[key] = url[key].toLowerCase();
      }

      //
      // Also parse the supplied query string in to an object. If we're supplied
      // with a custom parser as function use that instead of the default build-in
      // parser.
      //
      if (parser) url.query = parser(url.query);

      //
      // If the URL is relative, resolve the pathname against the base URL.
      //
      if (
          relative
        && location.slashes
        && url.pathname.charAt(0) !== '/'
        && (url.pathname !== '' || location.pathname !== '')
      ) {
        url.pathname = resolve(url.pathname, location.pathname);
      }

      //
      // Default to a / for pathname if none exists. This normalizes the URL
      // to always have a /
      //
      if (url.pathname.charAt(0) !== '/' && url.hostname) {
        url.pathname = '/' + url.pathname;
      }

      //
      // We should not add port numbers if they are already the default port number
      // for a given protocol. As the host also contains the port number we're going
      // override it with the hostname which contains no port number.
      //
      if (!requiresPort(url.port, url.protocol)) {
        url.host = url.hostname;
        url.port = '';
      }

      //
      // Parse down the `auth` for the username and password.
      //
      url.username = url.password = '';
      if (url.auth) {
        instruction = url.auth.split(':');
        url.username = instruction[0] || '';
        url.password = instruction[1] || '';
      }

      url.origin = url.protocol && url.host && url.protocol !== 'file:'
        ? url.protocol +'//'+ url.host
        : 'null';

      //
      // The href is just the compiled result.
      //
      url.href = url.toString();
    }

    /**
     * This is convenience method for changing properties in the URL instance to
     * insure that they all propagate correctly.
     *
     * @param {String} part          Property we need to adjust.
     * @param {Mixed} value          The newly assigned value.
     * @param {Boolean|Function} fn  When setting the query, it will be the function
     *                               used to parse the query.
     *                               When setting the protocol, double slash will be
     *                               removed from the final url if it is true.
     * @returns {URL} URL instance for chaining.
     * @public
     */
    function set(part, value, fn) {
      var url = this;

      switch (part) {
        case 'query':
          if ('string' === typeof value && value.length) {
            value = (fn || querystringify_1.parse)(value);
          }

          url[part] = value;
          break;

        case 'port':
          url[part] = value;

          if (!requiresPort(value, url.protocol)) {
            url.host = url.hostname;
            url[part] = '';
          } else if (value) {
            url.host = url.hostname +':'+ value;
          }

          break;

        case 'hostname':
          url[part] = value;

          if (url.port) value += ':'+ url.port;
          url.host = value;
          break;

        case 'host':
          url[part] = value;

          if (/:\d+$/.test(value)) {
            value = value.split(':');
            url.port = value.pop();
            url.hostname = value.join(':');
          } else {
            url.hostname = value;
            url.port = '';
          }

          break;

        case 'protocol':
          url.protocol = value.toLowerCase();
          url.slashes = !fn;
          break;

        case 'pathname':
        case 'hash':
          if (value) {
            var char = part === 'pathname' ? '/' : '#';
            url[part] = value.charAt(0) !== char ? char + value : value;
          } else {
            url[part] = value;
          }
          break;

        default:
          url[part] = value;
      }

      for (var i = 0; i < rules.length; i++) {
        var ins = rules[i];

        if (ins[4]) url[ins[1]] = url[ins[1]].toLowerCase();
      }

      url.origin = url.protocol && url.host && url.protocol !== 'file:'
        ? url.protocol +'//'+ url.host
        : 'null';

      url.href = url.toString();

      return url;
    }

    /**
     * Transform the properties back in to a valid and full URL string.
     *
     * @param {Function} stringify Optional query stringify function.
     * @returns {String} Compiled version of the URL.
     * @public
     */
    function toString(stringify) {
      if (!stringify || 'function' !== typeof stringify) stringify = querystringify_1.stringify;

      var query
        , url = this
        , protocol = url.protocol;

      if (protocol && protocol.charAt(protocol.length - 1) !== ':') protocol += ':';

      var result = protocol + (url.slashes ? '//' : '');

      if (url.username) {
        result += url.username;
        if (url.password) result += ':'+ url.password;
        result += '@';
      }

      result += url.host + url.pathname;

      query = 'object' === typeof url.query ? stringify(url.query) : url.query;
      if (query) result += '?' !== query.charAt(0) ? '?'+ query : query;

      if (url.hash) result += url.hash;

      return result;
    }

    Url.prototype = { set: set, toString: toString };

    //
    // Expose the URL parser and some additional properties that might be useful for
    // others or testing.
    //
    Url.extractProtocol = extractProtocol;
    Url.location = lolcation;
    Url.trimLeft = trimLeft;
    Url.qs = querystringify_1;

    var urlParse = Url;

    /**
     * This module serves as an Async wrapper for LocalStorage
     */

    var setItem = function (key, value) {
      return new Promise(function (resolve) {
        localStorage.setItem(key, value);
        resolve();
      });
    };

    var getItem = function (key) {
      return Promise.resolve(localStorage.getItem(key));
    };

    var removeItem = function (key) {
      return new Promise(function (resolve) {
        localStorage.removeItem(key);
        resolve();
      });
    };

    var tokenStorage = {
    	setItem: setItem,
    	getItem: getItem,
    	removeItem: removeItem
    };

    function _extends$g() { _extends$g = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$g.apply(this, arguments); }

    function _inheritsLoose$e(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; _setPrototypeOf$e(subClass, superClass); }

    function _setPrototypeOf$e(o, p) { _setPrototypeOf$e = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$e(o, p); }









    var _getName = function _getName(id) {
      return id.split('-').map(function (s) {
        return s.charAt(0).toUpperCase() + s.slice(1);
      }).join(' ');
    };

    var Provider = /*#__PURE__*/function (_RequestClient) {
      _inheritsLoose$e(Provider, _RequestClient);

      function Provider(uppy, opts) {
        var _this;

        _this = _RequestClient.call(this, uppy, opts) || this;
        _this.provider = opts.provider;
        _this.id = _this.provider;
        _this.name = _this.opts.name || _getName(_this.id);
        _this.pluginId = _this.opts.pluginId;
        _this.tokenKey = "companion-" + _this.pluginId + "-auth-token";
        _this.companionKeysParams = _this.opts.companionKeysParams;
        _this.preAuthToken = null;
        return _this;
      }

      var _proto = Provider.prototype;

      _proto.headers = function headers() {
        var _this2 = this;

        return Promise.all([_RequestClient.prototype.headers.call(this), this.getAuthToken()]).then(function (_ref) {
          var headers = _ref[0],
              token = _ref[1];
          var authHeaders = {};

          if (token) {
            authHeaders['uppy-auth-token'] = token;
          }

          if (_this2.companionKeysParams) {
            authHeaders['uppy-credentials-params'] = btoa(JSON.stringify({
              params: _this2.companionKeysParams
            }));
          }

          return _extends$g({}, headers, authHeaders);
        });
      };

      _proto.onReceiveResponse = function onReceiveResponse(response) {
        response = _RequestClient.prototype.onReceiveResponse.call(this, response);
        var plugin = this.uppy.getPlugin(this.pluginId);
        var oldAuthenticated = plugin.getPluginState().authenticated;
        var authenticated = oldAuthenticated ? response.status !== 401 : response.status < 400;
        plugin.setPluginState({
          authenticated: authenticated
        });
        return response;
      } // @todo(i.olarewaju) consider whether or not this method should be exposed
      ;

      _proto.setAuthToken = function setAuthToken(token) {
        return this.uppy.getPlugin(this.pluginId).storage.setItem(this.tokenKey, token);
      };

      _proto.getAuthToken = function getAuthToken() {
        return this.uppy.getPlugin(this.pluginId).storage.getItem(this.tokenKey);
      };

      _proto.authUrl = function authUrl(queries) {
        if (queries === void 0) {
          queries = {};
        }

        if (this.preAuthToken) {
          queries.uppyPreAuthToken = this.preAuthToken;
        }

        var strigifiedQueries = qsStringify(queries);
        strigifiedQueries = strigifiedQueries ? "?" + strigifiedQueries : strigifiedQueries;
        return this.hostname + "/" + this.id + "/connect" + strigifiedQueries;
      };

      _proto.fileUrl = function fileUrl(id) {
        return this.hostname + "/" + this.id + "/get/" + id;
      };

      _proto.fetchPreAuthToken = function fetchPreAuthToken() {
        var _this3 = this;

        if (!this.companionKeysParams) {
          return Promise.resolve();
        }

        return this.post(this.id + "/preauth/", {
          params: this.companionKeysParams
        }).then(function (res) {
          _this3.preAuthToken = res.token;
        }).catch(function (err) {
          _this3.uppy.log("[CompanionClient] unable to fetch preAuthToken " + err, 'warning');
        });
      };

      _proto.list = function list(directory) {
        return this.get(this.id + "/list/" + (directory || ''));
      };

      _proto.logout = function logout() {
        var _this4 = this;

        return this.get(this.id + "/logout").then(function (response) {
          return Promise.all([response, _this4.uppy.getPlugin(_this4.pluginId).storage.removeItem(_this4.tokenKey)]);
        }).then(function (_ref2) {
          var response = _ref2[0];
          return response;
        });
      };

      Provider.initPlugin = function initPlugin(plugin, opts, defaultOpts) {
        plugin.type = 'acquirer';
        plugin.files = [];

        if (defaultOpts) {
          plugin.opts = _extends$g({}, defaultOpts, opts);
        }

        if (opts.serverUrl || opts.serverPattern) {
          throw new Error('`serverUrl` and `serverPattern` have been renamed to `companionUrl` and `companionAllowedHosts` respectively in the 0.30.5 release. Please consult the docs (for example, https://uppy.io/docs/instagram/ for the Instagram plugin) and use the updated options.`');
        }

        if (opts.companionAllowedHosts) {
          var pattern = opts.companionAllowedHosts; // validate companionAllowedHosts param

          if (typeof pattern !== 'string' && !Array.isArray(pattern) && !(pattern instanceof RegExp)) {
            throw new TypeError(plugin.id + ": the option \"companionAllowedHosts\" must be one of string, Array, RegExp");
          }

          plugin.opts.companionAllowedHosts = pattern;
        } else {
          // does not start with https://
          if (/^(?!https?:\/\/).*$/i.test(opts.companionUrl)) {
            plugin.opts.companionAllowedHosts = "https://" + opts.companionUrl.replace(/^\/\//, '');
          } else {
            plugin.opts.companionAllowedHosts = new urlParse(opts.companionUrl).origin;
          }
        }

        plugin.storage = plugin.opts.storage || tokenStorage;
      };

      return Provider;
    }(RequestClient);

    function _inheritsLoose$f(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; _setPrototypeOf$f(subClass, superClass); }

    function _setPrototypeOf$f(o, p) { _setPrototypeOf$f = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$f(o, p); }



    var _getName$1 = function _getName(id) {
      return id.split('-').map(function (s) {
        return s.charAt(0).toUpperCase() + s.slice(1);
      }).join(' ');
    };

    var SearchProvider = /*#__PURE__*/function (_RequestClient) {
      _inheritsLoose$f(SearchProvider, _RequestClient);

      function SearchProvider(uppy, opts) {
        var _this;

        _this = _RequestClient.call(this, uppy, opts) || this;
        _this.provider = opts.provider;
        _this.id = _this.provider;
        _this.name = _this.opts.name || _getName$1(_this.id);
        _this.pluginId = _this.opts.pluginId;
        return _this;
      }

      var _proto = SearchProvider.prototype;

      _proto.fileUrl = function fileUrl(id) {
        return this.hostname + "/search/" + this.id + "/get/" + id;
      };

      _proto.search = function search(text, queries) {
        queries = queries ? "&" + queries : '';
        return this.get("search/" + this.id + "/list?q=" + encodeURIComponent(text) + queries);
      };

      return SearchProvider;
    }(RequestClient);

    var Socket = /*#__PURE__*/function () {
      function UppySocket(opts) {
        this.opts = opts;
        this._queued = [];
        this.isOpen = false;
        this.emitter = namespaceEmitter();
        this._handleMessage = this._handleMessage.bind(this);
        this.close = this.close.bind(this);
        this.emit = this.emit.bind(this);
        this.on = this.on.bind(this);
        this.once = this.once.bind(this);
        this.send = this.send.bind(this);

        if (!opts || opts.autoOpen !== false) {
          this.open();
        }
      }

      var _proto = UppySocket.prototype;

      _proto.open = function open() {
        var _this = this;

        this.socket = new WebSocket(this.opts.target);

        this.socket.onopen = function (e) {
          _this.isOpen = true;

          while (_this._queued.length > 0 && _this.isOpen) {
            var first = _this._queued[0];

            _this.send(first.action, first.payload);

            _this._queued = _this._queued.slice(1);
          }
        };

        this.socket.onclose = function (e) {
          _this.isOpen = false;
        };

        this.socket.onmessage = this._handleMessage;
      };

      _proto.close = function close() {
        if (this.socket) {
          this.socket.close();
        }
      };

      _proto.send = function send(action, payload) {
        // attach uuid
        if (!this.isOpen) {
          this._queued.push({
            action: action,
            payload: payload
          });

          return;
        }

        this.socket.send(JSON.stringify({
          action: action,
          payload: payload
        }));
      };

      _proto.on = function on(action, handler) {
        this.emitter.on(action, handler);
      };

      _proto.emit = function emit(action, payload) {
        this.emitter.emit(action, payload);
      };

      _proto.once = function once(action, handler) {
        this.emitter.once(action, handler);
      };

      _proto._handleMessage = function _handleMessage(e) {
        try {
          var message = JSON.parse(e.data);
          this.emit(message.action, message.payload);
        } catch (err) {
          console.log(err);
        }
      };

      return UppySocket;
    }();

    /**
     * Manages communications with Companion
     */









    var lib$8 = {
      RequestClient: RequestClient,
      Provider: Provider,
      SearchProvider: SearchProvider,
      Socket: Socket
    };

    function _emitSocketProgress(uploader, progressData, file) {
      var progress = progressData.progress,
          bytesUploaded = progressData.bytesUploaded,
          bytesTotal = progressData.bytesTotal;

      if (progress) {
        uploader.uppy.log("Upload progress: " + progress);
        uploader.uppy.emit('upload-progress', file, {
          uploader: uploader,
          bytesUploaded: bytesUploaded,
          bytesTotal: bytesTotal
        });
      }
    }

    var emitSocketProgress = lodash_throttle(_emitSocketProgress, 300, {
      leading: true,
      trailing: true
    });

    var getSocketHost = function getSocketHost(url) {
      // get the host domain
      var regex = /^(?:https?:\/\/|\/\/)?(?:[^@\n]+@)?(?:www\.)?([^\n]+)/i;
      var host = regex.exec(url)[1];
      var socketProtocol = /^http:\/\//i.test(url) ? 'ws' : 'wss';
      return socketProtocol + "://" + host;
    };

    var settle = function settle(promises) {
      var resolutions = [];
      var rejections = [];

      function resolved(value) {
        resolutions.push(value);
      }

      function rejected(error) {
        rejections.push(error);
      }

      var wait = Promise.all(promises.map(function (promise) {
        return promise.then(resolved, rejected);
      }));
      return wait.then(function () {
        return {
          successful: resolutions,
          failed: rejections
        };
      });
    };

    /**
     * Create a wrapper around an event emitter with a `remove` method to remove
     * all events that were added using the wrapped emitter.
     */
    var EventTracker = /*#__PURE__*/function () {
      function EventTracker(emitter) {
        this._events = [];
        this._emitter = emitter;
      }

      var _proto = EventTracker.prototype;

      _proto.on = function on(event, fn) {
        this._events.push([event, fn]);

        return this._emitter.on(event, fn);
      };

      _proto.remove = function remove() {
        var _this = this;

        this._events.forEach(function (_ref) {
          var event = _ref[0],
              fn = _ref[1];

          _this._emitter.off(event, fn);
        });
      };

      return EventTracker;
    }();

    /**
     * Helper to abort upload requests if there has not been any progress for `timeout` ms.
     * Create an instance using `timer = new ProgressTimeout(10000, onTimeout)`
     * Call `timer.progress()` to signal that there has been progress of any kind.
     * Call `timer.done()` when the upload has completed.
     */
    var ProgressTimeout = /*#__PURE__*/function () {
      function ProgressTimeout(timeout, timeoutHandler) {
        this._timeout = timeout;
        this._onTimedOut = timeoutHandler;
        this._isDone = false;
        this._aliveTimer = null;
        this._onTimedOut = this._onTimedOut.bind(this);
      }

      var _proto = ProgressTimeout.prototype;

      _proto.progress = function progress() {
        // Some browsers fire another progress event when the upload is
        // cancelled, so we have to ignore progress after the timer was
        // told to stop.
        if (this._isDone) return;

        if (this._timeout > 0) {
          if (this._aliveTimer) clearTimeout(this._aliveTimer);
          this._aliveTimer = setTimeout(this._onTimedOut, this._timeout);
        }
      };

      _proto.done = function done() {
        if (this._aliveTimer) {
          clearTimeout(this._aliveTimer);
          this._aliveTimer = null;
        }

        this._isDone = true;
      };

      return ProgressTimeout;
    }();

    var ProgressTimeout_1 = ProgressTimeout;

    function createCancelError() {
      return new Error('Cancelled');
    }

    var RateLimitedQueue = /*#__PURE__*/function () {
      function RateLimitedQueue(limit) {
        if (typeof limit !== 'number' || limit === 0) {
          this.limit = Infinity;
        } else {
          this.limit = limit;
        }

        this.activeRequests = 0;
        this.queuedHandlers = [];
      }

      var _proto = RateLimitedQueue.prototype;

      _proto._call = function _call(fn) {
        var _this = this;

        this.activeRequests += 1;
        var _done = false;
        var cancelActive;

        try {
          cancelActive = fn();
        } catch (err) {
          this.activeRequests -= 1;
          throw err;
        }

        return {
          abort: function abort() {
            if (_done) return;
            _done = true;
            _this.activeRequests -= 1;
            cancelActive();

            _this._queueNext();
          },
          done: function done() {
            if (_done) return;
            _done = true;
            _this.activeRequests -= 1;

            _this._queueNext();
          }
        };
      };

      _proto._queueNext = function _queueNext() {
        var _this2 = this;

        // Do it soon but not immediately, this allows clearing out the entire queue synchronously
        // one by one without continuously _advancing_ it (and starting new tasks before immediately
        // aborting them)
        Promise.resolve().then(function () {
          _this2._next();
        });
      };

      _proto._next = function _next() {
        if (this.activeRequests >= this.limit) {
          return;
        }

        if (this.queuedHandlers.length === 0) {
          return;
        } // Dispatch the next request, and update the abort/done handlers
        // so that cancelling it does the Right Thing (and doesn't just try
        // to dequeue an already-running request).


        var next = this.queuedHandlers.shift();

        var handler = this._call(next.fn);

        next.abort = handler.abort;
        next.done = handler.done;
      };

      _proto._queue = function _queue(fn, options) {
        var _this3 = this;

        if (options === void 0) {
          options = {};
        }

        var handler = {
          fn: fn,
          priority: options.priority || 0,
          abort: function abort() {
            _this3._dequeue(handler);
          },
          done: function done() {
            throw new Error('Cannot mark a queued request as done: this indicates a bug');
          }
        };
        var index = findIndex(this.queuedHandlers, function (other) {
          return handler.priority > other.priority;
        });

        if (index === -1) {
          this.queuedHandlers.push(handler);
        } else {
          this.queuedHandlers.splice(index, 0, handler);
        }

        return handler;
      };

      _proto._dequeue = function _dequeue(handler) {
        var index = this.queuedHandlers.indexOf(handler);

        if (index !== -1) {
          this.queuedHandlers.splice(index, 1);
        }
      };

      _proto.run = function run(fn, queueOptions) {
        if (this.activeRequests < this.limit) {
          return this._call(fn);
        }

        return this._queue(fn, queueOptions);
      };

      _proto.wrapPromiseFunction = function wrapPromiseFunction(fn, queueOptions) {
        var _this4 = this;

        return function () {
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }

          var queuedRequest;
          var outerPromise = new Promise(function (resolve, reject) {
            queuedRequest = _this4.run(function () {
              var cancelError;
              var innerPromise;

              try {
                innerPromise = Promise.resolve(fn.apply(void 0, args));
              } catch (err) {
                innerPromise = Promise.reject(err);
              }

              innerPromise.then(function (result) {
                if (cancelError) {
                  reject(cancelError);
                } else {
                  queuedRequest.done();
                  resolve(result);
                }
              }, function (err) {
                if (cancelError) {
                  reject(cancelError);
                } else {
                  queuedRequest.done();
                  reject(err);
                }
              });
              return function () {
                cancelError = createCancelError();
              };
            }, queueOptions);
          });

          outerPromise.abort = function () {
            queuedRequest.abort();
          };

          return outerPromise;
        };
      };

      return RateLimitedQueue;
    }();

    function isNetworkError(xhr) {
      if (!xhr) {
        return false;
      }

      return xhr.readyState !== 0 && xhr.readyState !== 4 || xhr.status === 0;
    }

    var isNetworkError_1 = isNetworkError;

    var _class$7, _temp$7;

    function _assertThisInitialized$4(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _inheritsLoose$g(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; _setPrototypeOf$g(subClass, superClass); }

    function _setPrototypeOf$g(o, p) { _setPrototypeOf$g = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$g(o, p); }

    function _extends$h() { _extends$h = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$h.apply(this, arguments); }

    var Plugin$7 = lib$1.Plugin;





    var Provider$1 = lib$8.Provider,
        RequestClient$1 = lib$8.RequestClient,
        Socket$1 = lib$8.Socket;

















    function buildResponseError(xhr, error) {
      // No error message
      if (!error) error = new Error('Upload error'); // Got an error message string

      if (typeof error === 'string') error = new Error(error); // Got something else

      if (!(error instanceof Error)) {
        error = _extends$h(new Error('Upload error'), {
          data: error
        });
      }

      if (isNetworkError_1(xhr)) {
        error = new NetworkError_1(error, xhr);
        return error;
      }

      error.request = xhr;
      return error;
    }
    /**
     * Set `data.type` in the blob to `file.meta.type`,
     * because we might have detected a more accurate file type in Uppy
     * https://stackoverflow.com/a/50875615
     *
     * @param {object} file File object with `data`, `size` and `meta` properties
     * @returns {object} blob updated with the new `type` set from `file.meta.type`
     */


    function setTypeInBlob(file) {
      var dataWithUpdatedType = file.data.slice(0, file.data.size, file.meta.type);
      return dataWithUpdatedType;
    }

    var lib$9 = (_temp$7 = _class$7 = /*#__PURE__*/function (_Plugin) {
      _inheritsLoose$g(XHRUpload, _Plugin);

      function XHRUpload(uppy, opts) {
        var _this;

        _this = _Plugin.call(this, uppy, opts) || this;
        _this.type = 'uploader';
        _this.id = _this.opts.id || 'XHRUpload';
        _this.title = 'XHRUpload';
        _this.defaultLocale = {
          strings: {
            timedOut: 'Upload stalled for %{seconds} seconds, aborting.'
          }
        }; // Default options

        var defaultOptions = {
          formData: true,
          fieldName: 'files[]',
          method: 'post',
          metaFields: null,
          responseUrlFieldName: 'url',
          bundle: false,
          headers: {},
          timeout: 30 * 1000,
          limit: 0,
          withCredentials: false,
          responseType: '',

          /**
           * @typedef respObj
           * @property {string} responseText
           * @property {number} status
           * @property {string} statusText
           * @property {object.<string, string>} headers
           *
           * @param {string} responseText the response body string
           * @param {XMLHttpRequest | respObj} response the response object (XHR or similar)
           */
          getResponseData: function getResponseData(responseText, response) {
            var parsedResponse = {};

            try {
              parsedResponse = JSON.parse(responseText);
            } catch (err) {
              console.log(err);
            }

            return parsedResponse;
          },

          /**
           *
           * @param {string} responseText the response body string
           * @param {XMLHttpRequest | respObj} response the response object (XHR or similar)
           */
          getResponseError: function getResponseError(responseText, response) {
            var error = new Error('Upload error');

            if (isNetworkError_1(response)) {
              error = new NetworkError_1(error, response);
            }

            return error;
          },

          /**
           * Check if the response from the upload endpoint indicates that the upload was successful.
           *
           * @param {number} status the response status code
           * @param {string} responseText the response body string
           * @param {XMLHttpRequest | respObj} response the response object (XHR or similar)
           */
          validateStatus: function validateStatus(status, responseText, response) {
            return status >= 200 && status < 300;
          }
        };
        _this.opts = _extends$h({}, defaultOptions, opts);

        _this.i18nInit();

        _this.handleUpload = _this.handleUpload.bind(_assertThisInitialized$4(_this)); // Simultaneous upload limiting is shared across all uploads with this plugin.
        // __queue is for internal Uppy use only!

        if (_this.opts.__queue instanceof RateLimitedQueue) {
          _this.requests = _this.opts.__queue;
        } else {
          _this.requests = new RateLimitedQueue(_this.opts.limit);
        }

        if (_this.opts.bundle && !_this.opts.formData) {
          throw new Error('`opts.formData` must be true when `opts.bundle` is enabled.');
        }

        _this.uploaderEvents = Object.create(null);
        return _this;
      }

      var _proto = XHRUpload.prototype;

      _proto.setOptions = function setOptions(newOpts) {
        _Plugin.prototype.setOptions.call(this, newOpts);

        this.i18nInit();
      };

      _proto.i18nInit = function i18nInit() {
        this.translator = new Translator([this.defaultLocale, this.uppy.locale, this.opts.locale]);
        this.i18n = this.translator.translate.bind(this.translator);
        this.setPluginState(); // so that UI re-renders and we see the updated locale
      };

      _proto.getOptions = function getOptions(file) {
        var overrides = this.uppy.getState().xhrUpload;
        var headers = this.opts.headers;

        var opts = _extends$h({}, this.opts, overrides || {}, file.xhrUpload || {}, {
          headers: {}
        }); // Support for `headers` as a function, only in the XHRUpload settings.
        // Options set by other plugins in Uppy state or on the files themselves are still merged in afterward.
        //
        // ```js
        // headers: (file) => ({ expires: file.meta.expires })
        // ```


        if (typeof headers === 'function') {
          opts.headers = headers(file);
        } else {
          _extends$h(opts.headers, this.opts.headers);
        }

        if (overrides) {
          _extends$h(opts.headers, overrides.headers);
        }

        if (file.xhrUpload) {
          _extends$h(opts.headers, file.xhrUpload.headers);
        }

        return opts;
      };

      _proto.addMetadata = function addMetadata(formData, meta, opts) {
        var metaFields = Array.isArray(opts.metaFields) ? opts.metaFields // Send along all fields by default.
        : Object.keys(meta);
        metaFields.forEach(function (item) {
          formData.append(item, meta[item]);
        });
      };

      _proto.createFormDataUpload = function createFormDataUpload(file, opts) {
        var formPost = new FormData();
        this.addMetadata(formPost, file.meta, opts);
        var dataWithUpdatedType = setTypeInBlob(file);

        if (file.name) {
          formPost.append(opts.fieldName, dataWithUpdatedType, file.meta.name);
        } else {
          formPost.append(opts.fieldName, dataWithUpdatedType);
        }

        return formPost;
      };

      _proto.createBundledUpload = function createBundledUpload(files, opts) {
        var _this2 = this;

        var formPost = new FormData();

        var _this$uppy$getState = this.uppy.getState(),
            meta = _this$uppy$getState.meta;

        this.addMetadata(formPost, meta, opts);
        files.forEach(function (file) {
          var opts = _this2.getOptions(file);

          var dataWithUpdatedType = setTypeInBlob(file);

          if (file.name) {
            formPost.append(opts.fieldName, dataWithUpdatedType, file.name);
          } else {
            formPost.append(opts.fieldName, dataWithUpdatedType);
          }
        });
        return formPost;
      };

      _proto.createBareUpload = function createBareUpload(file, opts) {
        return file.data;
      };

      _proto.upload = function upload(file, current, total) {
        var _this3 = this;

        var opts = this.getOptions(file);
        this.uppy.log("uploading " + current + " of " + total);
        return new Promise(function (resolve, reject) {
          _this3.uppy.emit('upload-started', file);

          var data = opts.formData ? _this3.createFormDataUpload(file, opts) : _this3.createBareUpload(file, opts);
          var xhr = new XMLHttpRequest();
          _this3.uploaderEvents[file.id] = new EventTracker(_this3.uppy);
          var timer = new ProgressTimeout_1(opts.timeout, function () {
            xhr.abort();
            queuedRequest.done();
            var error = new Error(_this3.i18n('timedOut', {
              seconds: Math.ceil(opts.timeout / 1000)
            }));

            _this3.uppy.emit('upload-error', file, error);

            reject(error);
          });
          var id = cuid_1();
          xhr.upload.addEventListener('loadstart', function (ev) {
            _this3.uppy.log("[XHRUpload] " + id + " started");
          });
          xhr.upload.addEventListener('progress', function (ev) {
            _this3.uppy.log("[XHRUpload] " + id + " progress: " + ev.loaded + " / " + ev.total); // Begin checking for timeouts when progress starts, instead of loading,
            // to avoid timing out requests on browser concurrency queue


            timer.progress();

            if (ev.lengthComputable) {
              _this3.uppy.emit('upload-progress', file, {
                uploader: _this3,
                bytesUploaded: ev.loaded,
                bytesTotal: ev.total
              });
            }
          });
          xhr.addEventListener('load', function (ev) {
            _this3.uppy.log("[XHRUpload] " + id + " finished");

            timer.done();
            queuedRequest.done();

            if (_this3.uploaderEvents[file.id]) {
              _this3.uploaderEvents[file.id].remove();

              _this3.uploaderEvents[file.id] = null;
            }

            if (opts.validateStatus(ev.target.status, xhr.responseText, xhr)) {
              var _body = opts.getResponseData(xhr.responseText, xhr);

              var uploadURL = _body[opts.responseUrlFieldName];
              var uploadResp = {
                status: ev.target.status,
                body: _body,
                uploadURL: uploadURL
              };

              _this3.uppy.emit('upload-success', file, uploadResp);

              if (uploadURL) {
                _this3.uppy.log("Download " + file.name + " from " + uploadURL);
              }

              return resolve(file);
            }

            var body = opts.getResponseData(xhr.responseText, xhr);
            var error = buildResponseError(xhr, opts.getResponseError(xhr.responseText, xhr));
            var response = {
              status: ev.target.status,
              body: body
            };

            _this3.uppy.emit('upload-error', file, error, response);

            return reject(error);
          });
          xhr.addEventListener('error', function (ev) {
            _this3.uppy.log("[XHRUpload] " + id + " errored");

            timer.done();
            queuedRequest.done();

            if (_this3.uploaderEvents[file.id]) {
              _this3.uploaderEvents[file.id].remove();

              _this3.uploaderEvents[file.id] = null;
            }

            var error = buildResponseError(xhr, opts.getResponseError(xhr.responseText, xhr));

            _this3.uppy.emit('upload-error', file, error);

            return reject(error);
          });
          xhr.open(opts.method.toUpperCase(), opts.endpoint, true); // IE10 does not allow setting `withCredentials` and `responseType`
          // before `open()` is called.

          xhr.withCredentials = opts.withCredentials;

          if (opts.responseType !== '') {
            xhr.responseType = opts.responseType;
          }

          var queuedRequest = _this3.requests.run(function () {
            // When using an authentication system like JWT, the bearer token goes as a header. This
            // header needs to be fresh each time the token is refreshed so computing and setting the
            // headers just before the upload starts enables this kind of authentication to work properly.
            // Otherwise, half-way through the list of uploads the token could be stale and the upload would fail.
            var currentOpts = _this3.getOptions(file);

            Object.keys(currentOpts.headers).forEach(function (header) {
              xhr.setRequestHeader(header, currentOpts.headers[header]);
            });
            xhr.send(data);
            return function () {
              timer.done();
              xhr.abort();
            };
          });

          _this3.onFileRemove(file.id, function () {
            queuedRequest.abort();
            reject(new Error('File removed'));
          });

          _this3.onCancelAll(file.id, function () {
            queuedRequest.abort();
            reject(new Error('Upload cancelled'));
          });
        });
      };

      _proto.uploadRemote = function uploadRemote(file, current, total) {
        var _this4 = this;

        var opts = this.getOptions(file);
        return new Promise(function (resolve, reject) {
          _this4.uppy.emit('upload-started', file);

          var fields = {};
          var metaFields = Array.isArray(opts.metaFields) ? opts.metaFields // Send along all fields by default.
          : Object.keys(file.meta);
          metaFields.forEach(function (name) {
            fields[name] = file.meta[name];
          });
          var Client = file.remote.providerOptions.provider ? Provider$1 : RequestClient$1;
          var client = new Client(_this4.uppy, file.remote.providerOptions);
          client.post(file.remote.url, _extends$h({}, file.remote.body, {
            endpoint: opts.endpoint,
            size: file.data.size,
            fieldname: opts.fieldName,
            metadata: fields,
            httpMethod: opts.method,
            useFormData: opts.formData,
            headers: opts.headers
          })).then(function (res) {
            var token = res.token;
            var host = getSocketHost(file.remote.companionUrl);
            var socket = new Socket$1({
              target: host + "/api/" + token,
              autoOpen: false
            });
            _this4.uploaderEvents[file.id] = new EventTracker(_this4.uppy);

            _this4.onFileRemove(file.id, function () {
              socket.send('pause', {});
              queuedRequest.abort();
              resolve("upload " + file.id + " was removed");
            });

            _this4.onCancelAll(file.id, function () {
              socket.send('pause', {});
              queuedRequest.abort();
              resolve("upload " + file.id + " was canceled");
            });

            _this4.onRetry(file.id, function () {
              socket.send('pause', {});
              socket.send('resume', {});
            });

            _this4.onRetryAll(file.id, function () {
              socket.send('pause', {});
              socket.send('resume', {});
            });

            socket.on('progress', function (progressData) {
              return emitSocketProgress(_this4, progressData, file);
            });
            socket.on('success', function (data) {
              var body = opts.getResponseData(data.response.responseText, data.response);
              var uploadURL = body[opts.responseUrlFieldName];
              var uploadResp = {
                status: data.response.status,
                body: body,
                uploadURL: uploadURL
              };

              _this4.uppy.emit('upload-success', file, uploadResp);

              queuedRequest.done();

              if (_this4.uploaderEvents[file.id]) {
                _this4.uploaderEvents[file.id].remove();

                _this4.uploaderEvents[file.id] = null;
              }

              return resolve();
            });
            socket.on('error', function (errData) {
              var resp = errData.response;
              var error = resp ? opts.getResponseError(resp.responseText, resp) : _extends$h(new Error(errData.error.message), {
                cause: errData.error
              });

              _this4.uppy.emit('upload-error', file, error);

              queuedRequest.done();

              if (_this4.uploaderEvents[file.id]) {
                _this4.uploaderEvents[file.id].remove();

                _this4.uploaderEvents[file.id] = null;
              }

              reject(error);
            });

            var queuedRequest = _this4.requests.run(function () {
              socket.open();

              if (file.isPaused) {
                socket.send('pause', {});
              }

              return function () {
                return socket.close();
              };
            });
          }).catch(function (err) {
            _this4.uppy.emit('upload-error', file, err);

            reject(err);
          });
        });
      };

      _proto.uploadBundle = function uploadBundle(files) {
        var _this5 = this;

        return new Promise(function (resolve, reject) {
          var endpoint = _this5.opts.endpoint;
          var method = _this5.opts.method;

          var optsFromState = _this5.uppy.getState().xhrUpload;

          var formData = _this5.createBundledUpload(files, _extends$h({}, _this5.opts, optsFromState || {}));

          var xhr = new XMLHttpRequest();
          var timer = new ProgressTimeout_1(_this5.opts.timeout, function () {
            xhr.abort();
            var error = new Error(_this5.i18n('timedOut', {
              seconds: Math.ceil(_this5.opts.timeout / 1000)
            }));
            emitError(error);
            reject(error);
          });

          var emitError = function emitError(error) {
            files.forEach(function (file) {
              _this5.uppy.emit('upload-error', file, error);
            });
          };

          xhr.upload.addEventListener('loadstart', function (ev) {
            _this5.uppy.log('[XHRUpload] started uploading bundle');

            timer.progress();
          });
          xhr.upload.addEventListener('progress', function (ev) {
            timer.progress();
            if (!ev.lengthComputable) return;
            files.forEach(function (file) {
              _this5.uppy.emit('upload-progress', file, {
                uploader: _this5,
                bytesUploaded: ev.loaded / ev.total * file.size,
                bytesTotal: file.size
              });
            });
          });
          xhr.addEventListener('load', function (ev) {
            timer.done();

            if (_this5.opts.validateStatus(ev.target.status, xhr.responseText, xhr)) {
              var body = _this5.opts.getResponseData(xhr.responseText, xhr);

              var uploadResp = {
                status: ev.target.status,
                body: body
              };
              files.forEach(function (file) {
                _this5.uppy.emit('upload-success', file, uploadResp);
              });
              return resolve();
            }

            var error = _this5.opts.getResponseError(xhr.responseText, xhr) || new Error('Upload error');
            error.request = xhr;
            emitError(error);
            return reject(error);
          });
          xhr.addEventListener('error', function (ev) {
            timer.done();
            var error = _this5.opts.getResponseError(xhr.responseText, xhr) || new Error('Upload error');
            emitError(error);
            return reject(error);
          });

          _this5.uppy.on('cancel-all', function () {
            timer.done();
            xhr.abort();
          });

          xhr.open(method.toUpperCase(), endpoint, true); // IE10 does not allow setting `withCredentials` and `responseType`
          // before `open()` is called.

          xhr.withCredentials = _this5.opts.withCredentials;

          if (_this5.opts.responseType !== '') {
            xhr.responseType = _this5.opts.responseType;
          }

          Object.keys(_this5.opts.headers).forEach(function (header) {
            xhr.setRequestHeader(header, _this5.opts.headers[header]);
          });
          xhr.send(formData);
          files.forEach(function (file) {
            _this5.uppy.emit('upload-started', file);
          });
        });
      };

      _proto.uploadFiles = function uploadFiles(files) {
        var _this6 = this;

        var promises = files.map(function (file, i) {
          var current = parseInt(i, 10) + 1;
          var total = files.length;

          if (file.error) {
            return Promise.reject(new Error(file.error));
          }

          if (file.isRemote) {
            return _this6.uploadRemote(file, current, total);
          }

          return _this6.upload(file, current, total);
        });
        return settle(promises);
      };

      _proto.onFileRemove = function onFileRemove(fileID, cb) {
        this.uploaderEvents[fileID].on('file-removed', function (file) {
          if (fileID === file.id) cb(file.id);
        });
      };

      _proto.onRetry = function onRetry(fileID, cb) {
        this.uploaderEvents[fileID].on('upload-retry', function (targetFileID) {
          if (fileID === targetFileID) {
            cb();
          }
        });
      };

      _proto.onRetryAll = function onRetryAll(fileID, cb) {
        var _this7 = this;

        this.uploaderEvents[fileID].on('retry-all', function (filesToRetry) {
          if (!_this7.uppy.getFile(fileID)) return;
          cb();
        });
      };

      _proto.onCancelAll = function onCancelAll(fileID, cb) {
        var _this8 = this;

        this.uploaderEvents[fileID].on('cancel-all', function () {
          if (!_this8.uppy.getFile(fileID)) return;
          cb();
        });
      };

      _proto.handleUpload = function handleUpload(fileIDs) {
        var _this9 = this;

        if (fileIDs.length === 0) {
          this.uppy.log('[XHRUpload] No files to upload!');
          return Promise.resolve();
        } // no limit configured by the user, and no RateLimitedQueue passed in by a "parent" plugin (basically just AwsS3) using the top secret `__queue` option


        if (this.opts.limit === 0 && !this.opts.__queue) {
          this.uppy.log('[XHRUpload] When uploading multiple files at once, consider setting the `limit` option (to `10` for example), to limit the number of concurrent uploads, which helps prevent memory and network issues: https://uppy.io/docs/xhr-upload/#limit-0', 'warning');
        }

        this.uppy.log('[XHRUpload] Uploading...');
        var files = fileIDs.map(function (fileID) {
          return _this9.uppy.getFile(fileID);
        });

        if (this.opts.bundle) {
          // if bundle: true, we don’t support remote uploads
          var isSomeFileRemote = files.some(function (file) {
            return file.isRemote;
          });

          if (isSomeFileRemote) {
            throw new Error('Can’t upload remote files when the `bundle: true` option is set');
          }

          if (typeof this.opts.headers === 'function') {
            throw new TypeError('`headers` may not be a function when the `bundle: true` option is set');
          }

          return this.uploadBundle(files);
        }

        return this.uploadFiles(files).then(function () {
          return null;
        });
      };

      _proto.install = function install() {
        if (this.opts.bundle) {
          var _this$uppy$getState2 = this.uppy.getState(),
              capabilities = _this$uppy$getState2.capabilities;

          this.uppy.setState({
            capabilities: _extends$h({}, capabilities, {
              individualCancellation: false
            })
          });
        }

        this.uppy.addUploader(this.handleUpload);
      };

      _proto.uninstall = function uninstall() {
        if (this.opts.bundle) {
          var _this$uppy$getState3 = this.uppy.getState(),
              capabilities = _this$uppy$getState3.capabilities;

          this.uppy.setState({
            capabilities: _extends$h({}, capabilities, {
              individualCancellation: true
            })
          });
        }

        this.uppy.removeUploader(this.handleUpload);
      };

      return XHRUpload;
    }(Plugin$7), _class$7.VERSION = "1.7.2", _temp$7);

    /* src\components\UploadModal.svelte generated by Svelte v3.30.1 */

    const { Error: Error_1, console: console_1 } = globals;

    function create_fragment$1(ctx) {
    	let dashboardmodal;
    	let current;

    	dashboardmodal = new DashboardModal({
    			props: { uppy: /*uppy*/ ctx[0] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(dashboardmodal.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error_1("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(dashboardmodal, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(dashboardmodal.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(dashboardmodal.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(dashboardmodal, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("UploadModal", slots, []);
    	const dispatch = createEventDispatcher();
    	let { maxFileSize = "1000000000" } = $$props; // 1GB
    	let { allowedFileTypes = null } = $$props;
    	let { maxNumberOfFiles = 1 } = $$props;
    	let { simultaneousUploads = 2 } = $$props;
    	let { fieldName = "file" } = $$props;
    	let { endpoint = null } = $$props;
    	let { uploadData = {} } = $$props;

    	endpoint || (() => {
    		throw new Error("Endpoint prop of upload modal is required");
    	})();

    	const uppy = new lib$1({
    			restrictions: { maxFileSize, allowedFileTypes }
    		}).use(lib$5).use(lib$9, {
    		endpoint,
    		fieldName,
    		limit: simultaneousUploads
    	});

    	uppy.on("complete", result => {
    		console.log("Upload complete! Upload result: ", result);
    		if (result.successful.length) dispatch("uploadCompleted", result);
    	});

    	uppy.on("upload-success", (file, response) => {
    		dispatch("uploadSuccessful", response);
    	}); // do something with file and response

    	uppy.on("upload-error", (file, error, response) => {
    		if (response.status === 409) {
    			console.error("Same filename already exists", file, error, response);
    		}
    	});

    	function openModal() {
    		uppy.getPlugin("Dashboard").openModal();
    	}

    	function closeModal() {
    		uppy.getPlugin("Dashboard").closeModal();
    	}

    	const writable_props = [
    		"maxFileSize",
    		"allowedFileTypes",
    		"maxNumberOfFiles",
    		"simultaneousUploads",
    		"fieldName",
    		"endpoint",
    		"uploadData"
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<UploadModal> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("maxFileSize" in $$props) $$invalidate(1, maxFileSize = $$props.maxFileSize);
    		if ("allowedFileTypes" in $$props) $$invalidate(2, allowedFileTypes = $$props.allowedFileTypes);
    		if ("maxNumberOfFiles" in $$props) $$invalidate(3, maxNumberOfFiles = $$props.maxNumberOfFiles);
    		if ("simultaneousUploads" in $$props) $$invalidate(4, simultaneousUploads = $$props.simultaneousUploads);
    		if ("fieldName" in $$props) $$invalidate(5, fieldName = $$props.fieldName);
    		if ("endpoint" in $$props) $$invalidate(6, endpoint = $$props.endpoint);
    		if ("uploadData" in $$props) $$invalidate(7, uploadData = $$props.uploadData);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		DashboardModal,
    		Uppy: lib$1,
    		Dashboard: lib$5,
    		XHRUpload: lib$9,
    		dispatch,
    		maxFileSize,
    		allowedFileTypes,
    		maxNumberOfFiles,
    		simultaneousUploads,
    		fieldName,
    		endpoint,
    		uploadData,
    		uppy,
    		openModal,
    		closeModal
    	});

    	$$self.$inject_state = $$props => {
    		if ("maxFileSize" in $$props) $$invalidate(1, maxFileSize = $$props.maxFileSize);
    		if ("allowedFileTypes" in $$props) $$invalidate(2, allowedFileTypes = $$props.allowedFileTypes);
    		if ("maxNumberOfFiles" in $$props) $$invalidate(3, maxNumberOfFiles = $$props.maxNumberOfFiles);
    		if ("simultaneousUploads" in $$props) $$invalidate(4, simultaneousUploads = $$props.simultaneousUploads);
    		if ("fieldName" in $$props) $$invalidate(5, fieldName = $$props.fieldName);
    		if ("endpoint" in $$props) $$invalidate(6, endpoint = $$props.endpoint);
    		if ("uploadData" in $$props) $$invalidate(7, uploadData = $$props.uploadData);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*uploadData*/ 128) {
    			 uppy.setMeta(uploadData);
    		}

    		if ($$self.$$.dirty & /*maxNumberOfFiles, maxFileSize, allowedFileTypes*/ 14) {
    			 uppy.setOptions({
    				restrictions: {
    					maxNumberOfFiles,
    					maxFileSize,
    					allowedFileTypes
    				}
    			});
    		}

    		if ($$self.$$.dirty & /*endpoint, fieldName, simultaneousUploads*/ 112) {
    			 uppy.getPlugin("XHRUpload").setOptions({
    				endpoint,
    				fieldName,
    				limit: simultaneousUploads
    			});
    		}
    	};

    	return [
    		uppy,
    		maxFileSize,
    		allowedFileTypes,
    		maxNumberOfFiles,
    		simultaneousUploads,
    		fieldName,
    		endpoint,
    		uploadData,
    		openModal,
    		closeModal
    	];
    }

    class UploadModal extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
    			maxFileSize: 1,
    			allowedFileTypes: 2,
    			maxNumberOfFiles: 3,
    			simultaneousUploads: 4,
    			fieldName: 5,
    			endpoint: 6,
    			uploadData: 7,
    			openModal: 8,
    			closeModal: 9
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "UploadModal",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get maxFileSize() {
    		throw new Error_1("<UploadModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set maxFileSize(value) {
    		throw new Error_1("<UploadModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get allowedFileTypes() {
    		throw new Error_1("<UploadModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set allowedFileTypes(value) {
    		throw new Error_1("<UploadModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get maxNumberOfFiles() {
    		throw new Error_1("<UploadModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set maxNumberOfFiles(value) {
    		throw new Error_1("<UploadModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get simultaneousUploads() {
    		throw new Error_1("<UploadModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set simultaneousUploads(value) {
    		throw new Error_1("<UploadModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get fieldName() {
    		throw new Error_1("<UploadModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set fieldName(value) {
    		throw new Error_1("<UploadModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get endpoint() {
    		throw new Error_1("<UploadModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set endpoint(value) {
    		throw new Error_1("<UploadModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get uploadData() {
    		throw new Error_1("<UploadModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set uploadData(value) {
    		throw new Error_1("<UploadModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get openModal() {
    		return this.$$.ctx[8];
    	}

    	set openModal(value) {
    		throw new Error_1("<UploadModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get closeModal() {
    		return this.$$.ctx[9];
    	}

    	set closeModal(value) {
    		throw new Error_1("<UploadModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\DummyForm.svelte generated by Svelte v3.30.1 */

    const { console: console_1$1 } = globals;
    const file$1 = "src\\components\\DummyForm.svelte";

    function create_fragment$2(ctx) {
    	let t0;
    	let form;
    	let input;
    	let t1;
    	let span;
    	let t2;
    	let t3;
    	let button;
    	let t5;
    	let uploadmodal;
    	let updating_openModal;
    	let current;
    	let mounted;
    	let dispose;

    	function uploadmodal_openModal_binding(value) {
    		/*uploadmodal_openModal_binding*/ ctx[3].call(null, value);
    	}

    	let uploadmodal_props = { endpoint: "/upload" };

    	if (/*openUploadAttachmentsModal*/ ctx[0] !== void 0) {
    		uploadmodal_props.openModal = /*openUploadAttachmentsModal*/ ctx[0];
    	}

    	uploadmodal = new UploadModal({ props: uploadmodal_props, $$inline: true });
    	binding_callbacks.push(() => bind(uploadmodal, "openModal", uploadmodal_openModal_binding));
    	uploadmodal.$on("uploadCompleted", onUploadCompleted);

    	const block = {
    		c: function create() {
    			t0 = space();
    			form = element("form");
    			input = element("input");
    			t1 = space();
    			span = element("span");
    			t2 = text(/*firstValue*/ ctx[1]);
    			t3 = space();
    			button = element("button");
    			button.textContent = "Open upload modal";
    			t5 = space();
    			create_component(uploadmodal.$$.fragment);
    			attr_dev(input, "type", "text");
    			attr_dev(input, "placeholder", "dummy input");
    			add_location(input, file$1, 13, 1, 221);
    			add_location(span, file$1, 19, 1, 307);
    			add_location(button, file$1, 23, 1, 344);
    			add_location(form, file$1, 12, 0, 212);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, form, anchor);
    			append_dev(form, input);
    			set_input_value(input, /*firstValue*/ ctx[1]);
    			append_dev(form, t1);
    			append_dev(form, span);
    			append_dev(span, t2);
    			append_dev(form, t3);
    			append_dev(form, button);
    			insert_dev(target, t5, anchor);
    			mount_component(uploadmodal, target, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[2]),
    					listen_dev(
    						button,
    						"click",
    						prevent_default(function () {
    							if (is_function(/*openUploadAttachmentsModal*/ ctx[0])) /*openUploadAttachmentsModal*/ ctx[0].apply(this, arguments);
    						}),
    						false,
    						true,
    						false
    					)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;

    			if (dirty & /*firstValue*/ 2 && input.value !== /*firstValue*/ ctx[1]) {
    				set_input_value(input, /*firstValue*/ ctx[1]);
    			}

    			if (!current || dirty & /*firstValue*/ 2) set_data_dev(t2, /*firstValue*/ ctx[1]);
    			const uploadmodal_changes = {};

    			if (!updating_openModal && dirty & /*openUploadAttachmentsModal*/ 1) {
    				updating_openModal = true;
    				uploadmodal_changes.openModal = /*openUploadAttachmentsModal*/ ctx[0];
    				add_flush_callback(() => updating_openModal = false);
    			}

    			uploadmodal.$set(uploadmodal_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(uploadmodal.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(uploadmodal.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(form);
    			if (detaching) detach_dev(t5);
    			destroy_component(uploadmodal, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function onUploadCompleted(ev) {
    	console.log("Upload completed", ev);
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("DummyForm", slots, []);
    	let openUploadAttachmentsModal;
    	let firstValue = "";
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$1.warn(`<DummyForm> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		firstValue = this.value;
    		$$invalidate(1, firstValue);
    	}

    	function uploadmodal_openModal_binding(value) {
    		openUploadAttachmentsModal = value;
    		$$invalidate(0, openUploadAttachmentsModal);
    	}

    	$$self.$capture_state = () => ({
    		UploadModal,
    		openUploadAttachmentsModal,
    		firstValue,
    		onUploadCompleted
    	});

    	$$self.$inject_state = $$props => {
    		if ("openUploadAttachmentsModal" in $$props) $$invalidate(0, openUploadAttachmentsModal = $$props.openUploadAttachmentsModal);
    		if ("firstValue" in $$props) $$invalidate(1, firstValue = $$props.firstValue);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		openUploadAttachmentsModal,
    		firstValue,
    		input_input_handler,
    		uploadmodal_openModal_binding
    	];
    }

    class DummyForm extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "DummyForm",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src\App.svelte generated by Svelte v3.30.1 */
    const file$2 = "src\\App.svelte";

    // (12:1) {#if formVisible}
    function create_if_block(ctx) {
    	let dummyform;
    	let current;
    	dummyform = new DummyForm({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(dummyform.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(dummyform, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(dummyform.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(dummyform.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(dummyform, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(12:1) {#if formVisible}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let main;
    	let button;
    	let t1;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*formVisible*/ ctx[0] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			button = element("button");
    			button.textContent = "Toggle form with upload";
    			t1 = space();
    			if (if_block) if_block.c();
    			add_location(button, file$2, 7, 1, 109);
    			add_location(main, file$2, 6, 0, 101);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, button);
    			append_dev(main, t1);
    			if (if_block) if_block.m(main, null);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[1], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*formVisible*/ ctx[0]) {
    				if (if_block) {
    					if (dirty & /*formVisible*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(main, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (if_block) if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let formVisible = false;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => $$invalidate(0, formVisible = !formVisible);
    	$$self.$capture_state = () => ({ DummyForm, formVisible });

    	$$self.$inject_state = $$props => {
    		if ("formVisible" in $$props) $$invalidate(0, formVisible = $$props.formVisible);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [formVisible, click_handler];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    const app = new App({
      target: document.body,
      props: {
        name: "world"
      }
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
