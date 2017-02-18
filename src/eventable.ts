//     Backbone.js 1.1.2

//     (c) 2010-2014 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Backbone may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://backbonejs.org


// Regular expression used to split event strings.
var eventSplitter = /\s+/;

// Implement fancy features of the Events API such as multiple event
// names `"change blur"` and jQuery-style event maps `{change: action}`
// in terms of the existing API.
var eventsApi = function(obj, action, name, rest) {
    if (!name) return true;

    // Handle event maps.
    if (typeof name === 'object') {
        for (var key in name) {
            obj[action].apply(obj, [key, name[key]].concat(rest));
        }
        return false;
    }

    // Handle space separated event names.
    if (eventSplitter.test(name)) {
        var names = name.split(eventSplitter);
        for (var i = 0, length = names.length; i < length; i++) {
            obj[action].apply(obj, [names[i]].concat(rest));
        }
        return false;
    }

    return true;
};

// A difficult-to-believe, but optimized internal dispatch function for
// triggering events. Tries to keep the usual cases speedy (most internal
// Backbone events have 3 arguments).
var triggerEvents = function(events, args) {
    var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
    switch (args.length) {
        case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
        case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
        case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
        case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
        default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args); return;
    }
};

import * as _ from "lodash";

type EventItem = {
    callback: any;
    context: any;
    ctx: any;
    priority: number;
}
type Dic = {
    [name: string]: any;
}
type Name = {
    [name: string]: (...args)=>void;
}


export class Dispatcher {

    private _events: {[name: string]: EventItem[]};
    private _listeningTo: {[listenId: string]: Dispatcher};
    private _listenId: string;
    on(name: string|Name, callback?: any, context?: any, priority?: number) {
        if (!eventsApi(this, 'on', name, [callback, context, priority]) || !callback) return this;
        this._events || (this._events = {});
        var events = this._events[<string>name] || (this._events[<string>name] = []);
        priority = _.isUndefined(priority) ? 0 : priority;
        var item = {callback: callback, context: context, priority: priority, ctx: context || this};
        for (var i: number = events.length - 1; i >=0 ; i--) {
            if (events[i].priority <= item.priority) {
                events.splice(i+1 , 0 , item);
                break;
            }
        }
        return this;
    }
    // Bind an event to only be triggered a single time. After the first time
    // the callback is invoked, it will be removed.
    once(name: string|Name, callback?: any, context?: any, priority?: number) {
        if (!eventsApi(this, 'once', name, [callback, context, priority]) || !callback) return this;
        var self = this;
        var once: any = _.once(function() {
            self.off(<string>name, once);
            callback.apply(this, arguments);
        });
        once._callback = callback;
        return this.on(name, once, context, priority);
    }
    // Remove one or many callbacks. If `context` is null, removes all
    // callbacks with that function. If `callback` is null, removes all
    // callbacks for the event. If `name` is null, removes all bound
    // callbacks for all events.
    off(name?: string|Name, callback?: any, context?: any) {
        if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;

        // Remove all callbacks for all events.
        if (!name && !callback && !context) {
            this._events = void 0;
            return this;
        }

        var names = name ? [name] : _.keys(this._events);
        for (var i = 0, length = names.length; i < length; i++) {
            name = names[i];

            // Bail out if there are no events stored.
            var events = this._events[<string>name];
            if (!events) continue;

            // Remove all callbacks for this event.
            if (!callback && !context) {
                delete this._events[<string>name];
                continue;
            }

            // Find any remaining events.
            var remaining = [];
            for (var j = 0, k = events.length; j < k; j++) {
                var event = events[j];
                if (
                    callback && callback !== event.callback &&
                    callback !== event.callback._callback ||
                    context && context !== event.context
                ) {
                    remaining.push(event);
                }
            }

            // Replace events if there are any remaining.  Otherwise, clean up.
            if (remaining.length) {
                this._events[<string>name] = remaining;
            } else {
                delete this._events[<string>name];
            }
        }

        return this;
    }
    bind(name: string|Name, callback?: any, context?: any, priority?: number) {
        this.on(name , callback , context , priority);
    }
    unbind(name?: string|Name, callback?: any, context?: any) {
        this.off(name , callback , context);
    }
    // Trigger one or many events, firing all bound callbacks. Callbacks are
    // passed the same arguments as `trigger` is, apart from the event name
    // (unless you're listening on `"all"`, which will cause your callback to
    // receive the true name of the event as the first argument).
    trigger(name: string|Dic, ...args) {
        if (!this._events) return this;
        if (!eventsApi(this, 'trigger', name, args)) return this;
        var events = this._events[<string>name];
        var allEvents = this._events["all"];
        if (events) triggerEvents(events, args);
        if (allEvents) triggerEvents(allEvents, arguments);
        return this;
    }

    // Inversion-of-control versions of `on` and `once`. Tell *this* object to
    // listen to an event in another object ... keeping track of what it's
    // listening to.
    listenTo(obj: Dispatcher, name: string|Name, callback?: any, priority?: number) {
        var listeningTo = this._listeningTo || (this._listeningTo = {});
        var id = obj._listenId || (obj._listenId = _.uniqueId('l'));
        listeningTo[id] = obj;
        if (typeof name === 'object') {
            priority = callback;
            obj.on(name , this , priority)
        } else {
            obj.on(name, callback, this , priority);
        }
        return this;
    }

    listenToOnce(obj: Dispatcher, name: string|Name, callback?: any, priority?: number) {
        if (typeof name === 'object') {
            priority = callback;
            for (var event in name) this.listenToOnce(obj, event, name[event], priority);
            return this;
        }
        if (eventSplitter.test(name)) {
            var names = name.split(eventSplitter);
            for (var i = 0, length = names.length; i < length; i++) {
              this.listenToOnce(obj, names[i], callback, priority);
            }
            return this;
        }
        if (!callback) return this;
        var once = _.once(function() {
            this.stopListening(obj, name, once);
            callback.apply(this, arguments);
        });
        once["_callback"] = callback;
        return this.listenTo(obj, name, once, priority);
    }

    // Tell this object to stop listening to either specific events ... or
    // to every object it's currently listening to.
    stopListening(obj?: Dispatcher, name?: string|Name, callback?: any) {
        var listeningTo = this._listeningTo;
        if (!listeningTo) return this;
        var remove = !name && !callback;
        if (!callback && typeof name === 'object') callback = this;
        if (obj) (listeningTo = {})[obj._listenId] = obj;
        for (var id in listeningTo) {
            obj = listeningTo[id];
            obj.off(name, callback, this);
            if (remove || _.isEmpty(obj._events)) delete this._listeningTo[id];
        }
        return this;
    }
    
}