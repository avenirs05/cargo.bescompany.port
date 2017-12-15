/*!
 * sly 1.6.1 - 8th Aug 2015
 * https://github.com/darsain/sly
 *
 * Licensed under the MIT license.
 * http://opensource.org/licenses/MIT
 */

;(function ($, w, undefined) {
	'use strict';

	var pluginName = 'sly';
	var className  = 'Sly';
	var namespace  = pluginName;

	// Local WindowAnimationTiming interface
	var cAF = w.cancelAnimationFrame || w.cancelRequestAnimationFrame;
	var rAF = w.requestAnimationFrame;

	// Support indicators
	var transform, gpuAcceleration;

	// Other global values
	var $doc = $(document);
	var dragInitEvents = 'touchstart.' + namespace + ' mousedown.' + namespace;
	var dragMouseEvents = 'mousemove.' + namespace + ' mouseup.' + namespace;
	var dragTouchEvents = 'touchmove.' + namespace + ' touchend.' + namespace;
	var wheelEvent = (document.implementation.hasFeature('Event.wheel', '3.0') ? 'wheel.' : 'mousewheel.') + namespace;
	var clickEvent = 'click.' + namespace;
	var mouseDownEvent = 'mousedown.' + namespace;
	var interactiveElements = ['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA'];
	var tmpArray = [];
	var time;

	// Math shorthands
	var abs = Math.abs;
	var sqrt = Math.sqrt;
	var pow = Math.pow;
	var round = Math.round;
	var max = Math.max;
	var min = Math.min;

	// Keep track of last fired global wheel event
	var lastGlobalWheel = 0;
	$doc.on(wheelEvent, function (event) {
		var sly = event.originalEvent[namespace];
		var time = +new Date();
		// Update last global wheel time, but only when event didn't originate
		// in Sly frame, or the origin was less than scrollHijack time ago
		if (!sly || sly.options.scrollHijack < time - lastGlobalWheel) lastGlobalWheel = time;
	});

	/**
	 * Sly.
	 *
	 * @class
	 *
	 * @param {Element} frame       DOM element of sly container.
	 * @param {Object}  options     Object with options.
	 * @param {Object}  callbackMap Callbacks map.
	 */
	function Sly(frame, options, callbackMap) {
		if (!(this instanceof Sly)) return new Sly(frame, options, callbackMap);

		// Extend options
		var o = $.extend({}, Sly.defaults, options);

		// Private variables
		var self = this;
		var parallax = isNumber(frame);

		// Frame
		var $frame = $(frame);
		var $slidee = o.slidee ? $(o.slidee).eq(0) : $frame.children().eq(0);
		var frameSize = 0;
		var slideeSize = 0;
		var pos = {
			start: 0,
			center: 0,
			end: 0,
			cur: 0,
			dest: 0
		};

		// Scrollbar
		var $sb = $(o.scrollBar).eq(0);
		var $handle = $sb.children().eq(0);
		var sbSize = 0;
		var handleSize = 0;
		var hPos = {
			start: 0,
			end: 0,
			cur: 0
		};

		// Pagesbar
		var $pb = $(o.pagesBar);
		var $pages = 0;
		var pages = [];

		// Items
		var $items = 0;
		var items = [];
		var rel = {
			firstItem: 0,
			lastItem: 0,
			centerItem: 0,
			activeItem: null,
			activePage: 0
		};

		// Styles
		var frameStyles = new StyleRestorer($frame[0]);
		var slideeStyles = new StyleRestorer($slidee[0]);
		var sbStyles = new StyleRestorer($sb[0]);
		var handleStyles = new StyleRestorer($handle[0]);

		// Navigation type booleans
		var basicNav = o.itemNav === 'basic';
		var forceCenteredNav = o.itemNav === 'forceCentered';
		var centeredNav = o.itemNav === 'centered' || forceCenteredNav;
		var itemNav = !parallax && (basicNav || centeredNav || forceCenteredNav);

		// Miscellaneous
		var $scrollSource = o.scrollSource ? $(o.scrollSource) : $frame;
		var $dragSource = o.dragSource ? $(o.dragSource) : $frame;
		var $forwardButton = $(o.forward);
		var $backwardButton = $(o.backward);
		var $prevButton = $(o.prev);
		var $nextButton = $(o.next);
		var $prevPageButton = $(o.prevPage);
		var $nextPageButton = $(o.nextPage);
		var callbacks = {};
		var last = {};
		var animation = {};
		var move = {};
		var dragging = {
			released: 1
		};
		var scrolling = {
			last: 0,
			delta: 0,
			resetTime: 200
		};
		var renderID = 0;
		var historyID = 0;
		var cycleID = 0;
		var continuousID = 0;
		var i, l;

		// Normalizing frame
		if (!parallax) {
			frame = $frame[0];
		}

		// Expose properties
		self.initialized = 0;
		self.frame = frame;
		self.slidee = $slidee[0];
		self.pos = pos;
		self.rel = rel;
		self.items = items;
		self.pages = pages;
		self.isPaused = 0;
		self.options = o;
		self.dragging = dragging;

		/**
		 * Loading function.
		 *
		 * Populate arrays, set sizes, bind events, ...
		 *
		 * @param {Boolean} [isInit] Whether load is called from within self.init().
		 * @return {Void}
		 */
		function load(isInit) {
			// Local variables
			var lastItemsCount = 0;
			var lastPagesCount = pages.length;

			// Save old position
			pos.old = $.extend({}, pos);

			// Reset global variables
			frameSize = parallax ? 0 : $frame[o.horizontal ? 'width' : 'height']();
			sbSize = $sb[o.horizontal ? 'width' : 'height']();
			slideeSize = parallax ? frame : $slidee[o.horizontal ? 'outerWidth' : 'outerHeight']();
			pages.length = 0;

			// Set position limits & relatives
			pos.start = 0;
			pos.end = max(slideeSize - frameSize, 0);

			// Sizes & offsets for item based navigations
			if (itemNav) {
				// Save the number of current items
				lastItemsCount = items.length;

				// Reset itemNav related variables
				$items = $slidee.children(o.itemSelector);
				items.length = 0;

				// Needed variables
				var paddingStart = getPx($slidee, o.horizontal ? 'paddingLeft' : 'paddingTop');
				var paddingEnd = getPx($slidee, o.horizontal ? 'paddingRight' : 'paddingBottom');
				var borderBox = $($items).css('boxSizing') === 'border-box';
				var areFloated = $items.css('float') !== 'none';
				var ignoredMargin = 0;
				var lastItemIndex = $items.length - 1;
				var lastItem;

				// Reset slideeSize
				slideeSize = 0;

				// Iterate through items
				$items.each(function (i, element) {
					// Item
					var $item = $(element);
					var rect = element.getBoundingClientRect();
					var itemSize = round(o.horizontal ? rect.width || rect.right - rect.left : rect.height || rect.bottom - rect.top);
					var itemMarginStart = getPx($item, o.horizontal ? 'marginLeft' : 'marginTop');
					var itemMarginEnd = getPx($item, o.horizontal ? 'marginRight' : 'marginBottom');
					var itemSizeFull = itemSize + itemMarginStart + itemMarginEnd;
					var singleSpaced = !itemMarginStart || !itemMarginEnd;
					var item = {};
					item.el = element;
					item.size = singleSpaced ? itemSize : itemSizeFull;
					item.half = item.size / 4;
					item.start = slideeSize + (singleSpaced ? itemMarginStart : 0);
					item.center = item.start - round(frameSize / 4 - item.size / 4);
					item.end = item.start - frameSize + item.size;

					// Account for slidee padding
					if (!i) {
						slideeSize += paddingStart;
					}

					// Increment slidee size for size of the active element
					slideeSize += itemSizeFull;

					// Try to account for vertical margin collapsing in vertical mode
					// It's not bulletproof, but should work in 99% of cases
					if (!o.horizontal && !areFloated) {
						// Subtract smaller margin, but only when top margin is not 0, and this is not the first element
						if (itemMarginEnd && itemMarginStart && i > 0) {
							slideeSize -= min(itemMarginStart, itemMarginEnd);
						}
					}

					// Things to be done on last item
					if (i === lastItemIndex) {
						item.end += paddingEnd;
						slideeSize += paddingEnd;
						ignoredMargin = singleSpaced ? itemMarginEnd : 0;
					}

					// Add item object to items array
					items.push(item);
					lastItem = item;
				});

				// Resize SLIDEE to fit all items
				$slidee[0].style[o.horizontal ? 'width' : 'height'] = (borderBox ? slideeSize: slideeSize - paddingStart - paddingEnd) + 'px';

				// Adjust internal SLIDEE size for last margin
				slideeSize -= ignoredMargin;

				// Set limits
				if (items.length) {
					pos.start =  items[0][forceCenteredNav ? 'center' : 'start'];
					pos.end = forceCenteredNav ? lastItem.center : frameSize < slideeSize ? lastItem.end : pos.start;
				} else {
					pos.start = pos.end = 0;
				}
			}

			// Calculate SLIDEE center position
			pos.center = round(pos.end / 2 + pos.start / 2);

			// Update relative positions
			updateRelatives();

			// Scrollbar
			if ($handle.length && sbSize > 0) {
				// Stretch scrollbar handle to represent the visible area
				if (o.dynamicHandle) {
					handleSize = pos.start === pos.end ? sbSize : round(sbSize * frameSize/2 / slideeSize);
					handleSize = within(handleSize, o.minHandleSize, sbSize);
					$handle[0].style[o.horizontal ? 'width' : 'height'] = handleSize - 100 + 'px';
				} else {
					handleSize = $handle[o.horizontal ? 'outerWidth' : 'outerHeight']();
				}

				hPos.end = sbSize - handleSize;

				if (!renderID) {
					syncScrollbar();
				}
			}

			// Pages
			if (!parallax && frameSize > 0) {
				var tempPagePos = pos.start;
				var pagesHtml = '';

				// Populate pages array
				if (itemNav) {
					$.each(items, function (i, item) {
						if (forceCenteredNav) {
							pages.push(item.center);
						} else if (item.start + item.size > tempPagePos && tempPagePos <= pos.end) {
							tempPagePos = item.start;
							pages.push(tempPagePos);
							tempPagePos += frameSize;
							if (tempPagePos > pos.end && tempPagePos < pos.end + frameSize) {
								pages.push(pos.end);
							}
						}
					});
				} else {
					while (tempPagePos - frameSize < pos.end) {
						pages.push(tempPagePos);
						tempPagePos += frameSize;
					}
				}

				// Pages bar
				if ($pb[0] && lastPagesCount !== pages.length) {
					for (var i = 0; i < pages.length; i++) {
						pagesHtml += o.pageBuilder.call(self, i);
					}
					$pages = $pb.html(pagesHtml).children();
					$pages.eq(rel.activePage).addClass(o.activeClass);
				}
			}

			// Extend relative variables object with some useful info
			rel.slideeSize = slideeSize;
			rel.frameSize = frameSize;
			rel.sbSize = sbSize;
			rel.handleSize = handleSize;

			// Activate requested position
			if (itemNav) {
				if (isInit && o.startAt != null) {
					activate(o.startAt);
					self[centeredNav ? 'toCenter' : 'toStart'](o.startAt);
				}
				// Fix possible overflowing
				var activeItem = items[rel.activeItem];
				slideTo(centeredNav && activeItem ? activeItem.center : within(pos.dest, pos.start, pos.end));
			} else {
				if (isInit) {
					if (o.startAt != null) slideTo(o.startAt, 1);
				} else {
					// Fix possible overflowing
					slideTo(within(pos.dest, pos.start, pos.end));
				}
			}

			// Trigger load event
			trigger('load');
		}
		self.reload = function () { load(); };

		/**
		 * Animate to a position.
		 *
		 * @param {Int}  newPos    New position.
		 * @param {Bool} immediate Reposition immediately without an animation.
		 * @param {Bool} dontAlign Do not align items, use the raw position passed in first argument.
		 *
		 * @return {Void}
		 */
		function slideTo(newPos, immediate, dontAlign) {
			// Align items
			if (itemNav && dragging.released && !dontAlign) {
				var tempRel = getRelatives(newPos);
				var isNotBordering = newPos > pos.start && newPos < pos.end;

				if (centeredNav) {
					if (isNotBordering) {
						newPos = items[tempRel.centerItem].center;
					}
					if (forceCenteredNav && o.activateMiddle) {
						activate(tempRel.centerItem);
					}
				} else if (isNotBordering) {
					newPos = items[tempRel.firstItem].start;
				}
			}

			// Handle overflowing position limits
			if (dragging.init && dragging.slidee && o.elasticBounds) {
				if (newPos > pos.end) {
					newPos = pos.end + (newPos - pos.end) / 6;
				} else if (newPos < pos.start) {
					newPos = pos.start + (newPos - pos.start) / 6;
				}
			} else {
				newPos = within(newPos, pos.start, pos.end);
			}

			// Update the animation object
			animation.start = +new Date();
			animation.time = 0;
			animation.from = pos.cur;
			animation.to = newPos;
			animation.delta = newPos - pos.cur;
			animation.tweesing = dragging.tweese || dragging.init && !dragging.slidee;
			animation.immediate = !animation.tweesing && (immediate || dragging.init && dragging.slidee || !o.speed);

			// Reset dragging tweesing request
			dragging.tweese = 0;

			// Start animation rendering
			if (newPos !== pos.dest) {
				pos.dest = newPos;
				trigger('change');
				if (!renderID) {
					render();
				}
			}

			// Reset next cycle timeout
			resetCycle();

			// Synchronize states
			updateRelatives();
			updateButtonsState();
			syncPagesbar();
		}

		/**
		 * Render animation frame.
		 *
		 * @return {Void}
		 */
		function render() {
			if (!self.initialized) {
				return;
			}

			// If first render call, wait for next animationFrame
			if (!renderID) {
				renderID = rAF(render);
				if (dragging.released) {
					trigger('moveStart');
				}
				return;
			}

			// If immediate repositioning is requested, don't animate.
			if (animation.immediate) {
				pos.cur = animation.to;
			}
			// Use tweesing for animations without known end point
			else if (animation.tweesing) {
				animation.tweeseDelta = animation.to - pos.cur;
				// Fuck Zeno's paradox
				if (abs(animation.tweeseDelta) < 0.1) {
					pos.cur = animation.to;
				} else {
					pos.cur += animation.tweeseDelta * (dragging.released ? o.swingSpeed : o.syncSpeed);
				}
			}
			// Use tweening for basic animations with known end point
			else {
				animation.time = min(+new Date() - animation.start, o.speed);
				pos.cur = animation.from + animation.delta * $.easing[o.easing](animation.time/o.speed, animation.time, 0, 1, o.speed);
			}

			// If there is nothing more to render break the rendering loop, otherwise request new animation frame.
			if (animation.to === pos.cur) {
				pos.cur = animation.to;
				dragging.tweese = renderID = 0;
			} else {
				renderID = rAF(render);
			}

			trigger('move');

			// Update SLIDEE position
			if (!parallax) {
				if (transform) {
					$slidee[0].style[transform] = gpuAcceleration + (o.horizontal ? 'translateX' : 'translateY') + '(' + (-pos.cur) + 'px)';
				} else {
					$slidee[0].style[o.horizontal ? 'left' : 'top'] = -round(pos.cur) + 'px';
				}
			}

			// When animation reached the end, and dragging is not active, trigger moveEnd
			if (!renderID && dragging.released) {
				trigger('moveEnd');
			}

			syncScrollbar();
		}

		/**
		 * Synchronizes scrollbar with the SLIDEE.
		 *
		 * @return {Void}
		 */
		function syncScrollbar() {
			if ($handle.length) {
				hPos.cur = pos.start === pos.end ? 0 : (((dragging.init && !dragging.slidee) ? pos.dest : pos.cur) - pos.start) / (pos.end - pos.start) * hPos.end;
				hPos.cur = within(round(hPos.cur), hPos.start, hPos.end);
				if (last.hPos !== hPos.cur) {
					last.hPos = hPos.cur;
					if (transform) {
						$handle[0].style[transform] = gpuAcceleration + (o.horizontal ? 'translateX' : 'translateY') + '(' + hPos.cur + 'px)';
					} else {
						$handle[0].style[o.horizontal ? 'left' : 'top'] = hPos.cur + 'px';
					}
				}
			}
		}

		/**
		 * Synchronizes pagesbar with SLIDEE.
		 *
		 * @return {Void}
		 */
		function syncPagesbar() {
			if ($pages[0] && last.page !== rel.activePage) {
				last.page = rel.activePage;
				$pages.removeClass(o.activeClass).eq(rel.activePage).addClass(o.activeClass);
				trigger('activePage', last.page);
			}
		}

		/**
		 * Returns the position object.
		 *
		 * @param {Mixed} item
		 *
		 * @return {Object}
		 */
		self.getPos = function (item) {
			if (itemNav) {
				var index = getIndex(item);
				return index !== -1 ? items[index] : false;
			} else {
				var $item = $slidee.find(item).eq(0);

				if ($item[0]) {
					var offset = o.horizontal ? $item.offset().left - $slidee.offset().left : $item.offset().top - $slidee.offset().top;
					var size = $item[o.horizontal ? 'outerWidth' : 'outerHeight']();

					return {
						start: offset,
						center: offset - frameSize / 2 + size / 2,
						end: offset - frameSize + size,
						size: size
					};
				} else {
					return false;
				}
			}
		};

		/**
		 * Continuous move in a specified direction.
		 *
		 * @param  {Bool} forward True for forward movement, otherwise it'll go backwards.
		 * @param  {Int}  speed   Movement speed in pixels per frame. Overrides options.moveBy value.
		 *
		 * @return {Void}
		 */
		self.moveBy = function (speed) {
			move.speed = speed;
			// If already initiated, or there is nowhere to move, abort
			if (dragging.init || !move.speed || pos.cur === (move.speed > 0 ? pos.end : pos.start)) {
				return;
			}
			// Initiate move object
			move.lastTime = +new Date();
			move.startPos = pos.cur;
			// Set dragging as initiated
			continuousInit('button');
			dragging.init = 1;
			// Start movement
			trigger('moveStart');
			cAF(continuousID);
			moveLoop();
		};

		/**
		 * Continuous movement loop.
		 *
		 * @return {Void}
		 */
		function moveLoop() {
			// If there is nowhere to move anymore, stop
			if (!move.speed || pos.cur === (move.speed > 0 ? pos.end : pos.start)) {
				self.stop();
			}
			// Request new move loop if it hasn't been stopped
			continuousID = dragging.init ? rAF(moveLoop) : 0;
			// Update move object
			move.now = +new Date();
			move.pos = pos.cur + (move.now - move.lastTime) / 1000 * move.speed;
			// Slide
			slideTo(dragging.init ? move.pos : round(move.pos));
			// Normally, this is triggered in render(), but if there
			// is nothing to render, we have to do it manually here.
			if (!dragging.init && pos.cur === pos.dest) {
				trigger('moveEnd');
			}
			// Update times for future iteration
			move.lastTime = move.now;
		}

		/**
		 * Stops continuous movement.
		 *
		 * @return {Void}
		 */
		self.stop = function () {
			if (dragging.source === 'button') {
				dragging.init = 0;
				dragging.released = 1;
			}
		};

		/**
		 * Activate previous item.
		 *
		 * @return {Void}
		 */
		self.prev = function () {
			self.activate(rel.activeItem == null ? 0 : rel.activeItem - 1);
		};

		/**
		 * Activate next item.
		 *
		 * @return {Void}
		 */
		self.next = function () {
			self.activate(rel.activeItem == null ? 0 : rel.activeItem + 1);
		};

		/**
		 * Activate previous page.
		 *
		 * @return {Void}
		 */
		self.prevPage = function () {
			self.activatePage(rel.activePage - 1);
		};

		/**
		 * Activate next page.
		 *
		 * @return {Void}
		 */
		self.nextPage = function () {
			self.activatePage(rel.activePage + 1);
		};

		/**
		 * Slide SLIDEE by amount of pixels.
		 *
		 * @param {Int}  delta     Pixels/Items. Positive means forward, negative means backward.
		 * @param {Bool} immediate Reposition immediately without an animation.
		 *
		 * @return {Void}
		 */
		self.slideBy = function (delta, immediate) {
			if (!delta) {
				return;
			}
			if (itemNav) {
				self[centeredNav ? 'toCenter' : 'toStart'](
					within((centeredNav ? rel.centerItem : rel.firstItem) + o.scrollBy * delta, 0, items.length)
				);
			} else {
				slideTo(pos.dest + delta, immediate);
			}
		};

		/**
		 * Animate SLIDEE to a specific position.
		 *
		 * @param {Int}  pos       New position.
		 * @param {Bool} immediate Reposition immediately without an animation.
		 *
		 * @return {Void}
		 */
		self.slideTo = function (pos, immediate) {
			slideTo(pos, immediate);
		};

		/**
		 * Core method for handling `toLocation` methods.
		 *
		 * @param  {String} location
		 * @param  {Mixed}  item
		 * @param  {Bool}   immediate
		 *
		 * @return {Void}
		 */
		function to(location, item, immediate) {
			// Optional arguments logic
			if (type(item) === 'boolean') {
				immediate = item;
				item = undefined;
			}

			if (item === undefined) {
				slideTo(pos[location], immediate);
			} else {
				// You can't align items to sides of the frame
				// when centered navigation type is enabled
				if (centeredNav && location !== 'center') {
					return;
				}

				var itemPos = self.getPos(item);
				if (itemPos) {
					slideTo(itemPos[location], immediate, !centeredNav);
				}
			}
		}

		/**
		 * Animate element or the whole SLIDEE to the start of the frame.
		 *
		 * @param {Mixed} item      Item DOM element, or index starting at 0. Omitting will animate SLIDEE.
		 * @param {Bool}  immediate Reposition immediately without an animation.
		 *
		 * @return {Void}
		 */
		self.toStart = function (item, immediate) {
			to('start', item, immediate);
		};

		/**
		 * Animate element or the whole SLIDEE to the end of the frame.
		 *
		 * @param {Mixed} item      Item DOM element, or index starting at 0. Omitting will animate SLIDEE.
		 * @param {Bool}  immediate Reposition immediately without an animation.
		 *
		 * @return {Void}
		 */
		self.toEnd = function (item, immediate) {
			to('end', item, immediate);
		};

		/**
		 * Animate element or the whole SLIDEE to the center of the frame.
		 *
		 * @param {Mixed} item      Item DOM element, or index starting at 0. Omitting will animate SLIDEE.
		 * @param {Bool}  immediate Reposition immediately without an animation.
		 *
		 * @return {Void}
		 */
		self.toCenter = function (item, immediate) {
			to('center', item, immediate);
		};

		/**
		 * Get the index of an item in SLIDEE.
		 *
		 * @param {Mixed} item     Item DOM element.
		 *
		 * @return {Int}  Item index, or -1 if not found.
		 */
		function getIndex(item) {
			return item != null ?
					isNumber(item) ?
						item >= 0 && item < items.length ? item : -1 :
						$items.index(item) :
					-1;
		}
		// Expose getIndex without lowering the compressibility of it,
		// as it is used quite often throughout Sly.
		self.getIndex = getIndex;

		/**
		 * Get index of an item in SLIDEE based on a variety of input types.
		 *
		 * @param  {Mixed} item DOM element, positive or negative integer.
		 *
		 * @return {Int}   Item index, or -1 if not found.
		 */
		function getRelativeIndex(item) {
			return getIndex(isNumber(item) && item < 0 ? item + items.length : item);
		}

		/**
		 * Activates an item.
		 *
		 * @param  {Mixed} item Item DOM element, or index starting at 0.
		 *
		 * @return {Mixed} Activated item index or false on fail.
		 */
		function activate(item, force) {
			var index = getIndex(item);

			if (!itemNav || index < 0) {
				return false;
			}

			// Update classes, last active index, and trigger active event only when there
			// has been a change. Otherwise just return the current active index.
			if (last.active !== index || force) {
				// Update classes
				$items.eq(rel.activeItem).removeClass(o.activeClass);
				$items.eq(index).addClass(o.activeClass);

				last.active = rel.activeItem = index;

				updateButtonsState();
				trigger('active', index);
			}

			return index;
		}

		/**
		 * Activates an item and helps with further navigation when o.smart is enabled.
		 *
		 * @param {Mixed} item      Item DOM element, or index starting at 0.
		 * @param {Bool}  immediate Whether to reposition immediately in smart navigation.
		 *
		 * @return {Void}
		 */
		self.activate = function (item, immediate) {
			var index = activate(item);

			// Smart navigation
			if (o.smart && index !== false) {
				// When centeredNav is enabled, center the element.
				// Otherwise, determine where to position the element based on its current position.
				// If the element is currently on the far end side of the frame, assume that user is
				// moving forward and animate it to the start of the visible frame, and vice versa.
				if (centeredNav) {
					self.toCenter(index, immediate);
				} else if (index >= rel.lastItem) {
					self.toStart(index, immediate);
				} else if (index <= rel.firstItem) {
					self.toEnd(index, immediate);
				} else {
					resetCycle();
				}
			}
		};

		/**
		 * Activates a page.
		 *
		 * @param {Int}  index     Page index, starting from 0.
		 * @param {Bool} immediate Whether to reposition immediately without animation.
		 *
		 * @return {Void}
		 */
		self.activatePage = function (index, immediate) {
			if (isNumber(index)) {
				slideTo(pages[within(index, 0, pages.length - 1)], immediate);
			}
		};

		/**
		 * Return relative positions of items based on their visibility within FRAME.
		 *
		 * @param {Int} slideePos Position of SLIDEE.
		 *
		 * @return {Void}
		 */
		function getRelatives(slideePos) {
			slideePos = within(isNumber(slideePos) ? slideePos : pos.dest, pos.start, pos.end);

			var relatives = {};
			var centerOffset = forceCenteredNav ? 0 : frameSize / 2;

			// Determine active page
			if (!parallax) {
				for (var p = 0, pl = pages.length; p < pl; p++) {
					if (slideePos >= pos.end || p === pages.length - 1) {
						relatives.activePage = pages.length - 1;
						break;
					}

					if (slideePos <= pages[p] + centerOffset) {
						relatives.activePage = p;
						break;
					}
				}
			}

			// Relative item indexes
			if (itemNav) {
				var first = false;
				var last = false;
				var center = false;

				// From start
				for (var i = 0, il = items.length; i < il; i++) {
					// First item
					if (first === false && slideePos <= items[i].start + items[i].half) {
						first = i;
					}

					// Center item
					if (center === false && slideePos <= items[i].center + items[i].half) {
						center = i;
					}

					// Last item
					if (i === il - 1 || slideePos <= items[i].end + items[i].half) {
						last = i;
						break;
					}
				}

				// Safe assignment, just to be sure the false won't be returned
				relatives.firstItem = isNumber(first) ? first : 0;
				relatives.centerItem = isNumber(center) ? center : relatives.firstItem;
				relatives.lastItem = isNumber(last) ? last : relatives.centerItem;
			}

			return relatives;
		}

		/**
		 * Update object with relative positions.
		 *
		 * @param {Int} newPos
		 *
		 * @return {Void}
		 */
		function updateRelatives(newPos) {
			$.extend(rel, getRelatives(newPos));
		}

		/**
		 * Disable navigation buttons when needed.
		 *
		 * Adds disabledClass, and when the button is <button> or <input>, activates :disabled state.
		 *
		 * @return {Void}
		 */
		function updateButtonsState() {
			var isStart = pos.dest <= pos.start;
			var isEnd = pos.dest >= pos.end;
			var slideePosState = (isStart ? 1 : 0) | (isEnd ? 2 : 0);

			// Update paging buttons only if there has been a change in SLIDEE position
			if (last.slideePosState !== slideePosState) {
				last.slideePosState = slideePosState;

				if ($prevPageButton.is('button,input')) {
					$prevPageButton.prop('disabled', isStart);
				}

				if ($nextPageButton.is('button,input')) {
					$nextPageButton.prop('disabled', isEnd);
				}

				$prevPageButton.add($backwardButton)[isStart ? 'addClass' : 'removeClass'](o.disabledClass);
				$nextPageButton.add($forwardButton)[isEnd ? 'addClass' : 'removeClass'](o.disabledClass);
			}

			// Forward & Backward buttons need a separate state caching because we cannot "property disable"
			// them while they are being used, as disabled buttons stop emitting mouse events.
			if (last.fwdbwdState !== slideePosState && dragging.released) {
				last.fwdbwdState = slideePosState;

				if ($backwardButton.is('button,input')) {
					$backwardButton.prop('disabled', isStart);
				}

				if ($forwardButton.is('button,input')) {
					$forwardButton.prop('disabled', isEnd);
				}
			}

			// Item navigation
			if (itemNav && rel.activeItem != null) {
				var isFirst = rel.activeItem === 0;
				var isLast = rel.activeItem >= items.length - 1;
				var itemsButtonState = (isFirst ? 1 : 0) | (isLast ? 2 : 0);

				if (last.itemsButtonState !== itemsButtonState) {
					last.itemsButtonState = itemsButtonState;

					if ($prevButton.is('button,input')) {
						$prevButton.prop('disabled', isFirst);
					}

					if ($nextButton.is('button,input')) {
						$nextButton.prop('disabled', isLast);
					}

					$prevButton[isFirst ? 'addClass' : 'removeClass'](o.disabledClass);
					$nextButton[isLast ? 'addClass' : 'removeClass'](o.disabledClass);
				}
			}
		}

		/**
		 * Resume cycling.
		 *
		 * @param {Int} priority Resume pause with priority lower or equal than this. Used internally for pauseOnHover.
		 *
		 * @return {Void}
		 */
		self.resume = function (priority) {
			if (!o.cycleBy || !o.cycleInterval || o.cycleBy === 'items' && (!items[0] || rel.activeItem == null) || priority < self.isPaused) {
				return;
			}

			self.isPaused = 0;

			if (cycleID) {
				cycleID = clearTimeout(cycleID);
			} else {
				trigger('resume');
			}

			cycleID = setTimeout(function () {
				trigger('cycle');
				switch (o.cycleBy) {
					case 'items':
						self.activate(rel.activeItem >= items.length - 1 ? 0 : rel.activeItem + 1);
						break;

					case 'pages':
						self.activatePage(rel.activePage >= pages.length - 1 ? 0 : rel.activePage + 1);
						break;
				}
			}, o.cycleInterval);
		};

		/**
		 * Pause cycling.
		 *
		 * @param {Int} priority Pause priority. 100 is default. Used internally for pauseOnHover.
		 *
		 * @return {Void}
		 */
		self.pause = function (priority) {
			if (priority < self.isPaused) {
				return;
			}

			self.isPaused = priority || 100;

			if (cycleID) {
				cycleID = clearTimeout(cycleID);
				trigger('pause');
			}
		};

		/**
		 * Toggle cycling.
		 *
		 * @return {Void}
		 */
		self.toggle = function () {
			self[cycleID ? 'pause' : 'resume']();
		};

		/**
		 * Updates a signle or multiple option values.
		 *
		 * @param {Mixed} name  Name of the option that should be updated, or object that will extend the options.
		 * @param {Mixed} value New option value.
		 *
		 * @return {Void}
		 */
		self.set = function (name, value) {
			if ($.isPlainObject(name)) {
				$.extend(o, name);
			} else if (o.hasOwnProperty(name)) {
				o[name] = value;
			}
		};

		/**
		 * Add one or multiple items to the SLIDEE end, or a specified position index.
		 *
		 * @param {Mixed} element Node element, or HTML string.
		 * @param {Int}   index   Index of a new item position. By default item is appended at the end.
		 *
		 * @return {Void}
		 */
		self.add = function (element, index) {
			var $element = $(element);

			if (itemNav) {
				// Insert the element(s)
				if (index == null || !items[0] || index >= items.length) {
					$element.appendTo($slidee);
				} else if (items.length) {
					$element.insertBefore(items[index].el);
				}

				// Adjust the activeItem index
				if (rel.activeItem != null && index <= rel.activeItem) {
					last.active = rel.activeItem += $element.length;
				}
			} else {
				$slidee.append($element);
			}

			// Reload
			load();
		};

		/**
		 * Remove an item from SLIDEE.
		 *
		 * @param {Mixed} element Item index, or DOM element.
		 * @param {Int}   index   Index of a new item position. By default item is appended at the end.
		 *
		 * @return {Void}
		 */
		self.remove = function (element) {
			if (itemNav) {
				var index = getRelativeIndex(element);

				if (index > -1) {
					// Remove the element
					$items.eq(index).remove();

					// If the current item is being removed, activate new one after reload
					var reactivate = index === rel.activeItem;

					// Adjust the activeItem index
					if (rel.activeItem != null && index < rel.activeItem) {
						last.active = --rel.activeItem;
					}

					// Reload
					load();

					// Activate new item at the removed position
					if (reactivate) {
						last.active = null;
						self.activate(rel.activeItem);
					}
				}
			} else {
				$(element).remove();
				load();
			}
		};

		/**
		 * Helps re-arranging items.
		 *
		 * @param  {Mixed} item     Item DOM element, or index starting at 0. Use negative numbers to select items from the end.
		 * @param  {Mixed} position Item insertion anchor. Accepts same input types as item argument.
		 * @param  {Bool}  after    Insert after instead of before the anchor.
		 *
		 * @return {Void}
		 */
		function moveItem(item, position, after) {
			item = getRelativeIndex(item);
			position = getRelativeIndex(position);

			// Move only if there is an actual change requested
			if (item > -1 && position > -1 && item !== position && (!after || position !== item - 1) && (after || position !== item + 1)) {
				$items.eq(item)[after ? 'insertAfter' : 'insertBefore'](items[position].el);

				var shiftStart = item < position ? item : (after ? position : position - 1);
				var shiftEnd = item > position ? item : (after ? position + 1 : position);
				var shiftsUp = item > position;

				// Update activeItem index
				if (rel.activeItem != null) {
					if (item === rel.activeItem) {
						last.active = rel.activeItem = after ? (shiftsUp ? position + 1 : position) : (shiftsUp ? position : position - 1);
					} else if (rel.activeItem > shiftStart && rel.activeItem < shiftEnd) {
						last.active = rel.activeItem += shiftsUp ? 1 : -1;
					}
				}

				// Reload
				load();
			}
		}

		/**
		 * Move item after the target anchor.
		 *
		 * @param  {Mixed} item     Item to be moved. Can be DOM element or item index.
		 * @param  {Mixed} position Target position anchor. Can be DOM element or item index.
		 *
		 * @return {Void}
		 */
		self.moveAfter = function (item, position) {
			moveItem(item, position, 1);
		};

		/**
		 * Move item before the target anchor.
		 *
		 * @param  {Mixed} item     Item to be moved. Can be DOM element or item index.
		 * @param  {Mixed} position Target position anchor. Can be DOM element or item index.
		 *
		 * @return {Void}
		 */
		self.moveBefore = function (item, position) {
			moveItem(item, position);
		};

		/**
		 * Registers callbacks.
		 *
		 * @param  {Mixed} name  Event name, or callbacks map.
		 * @param  {Mixed} fn    Callback, or an array of callback functions.
		 *
		 * @return {Void}
		 */
		self.on = function (name, fn) {
			// Callbacks map
			if (type(name) === 'object') {
				for (var key in name) {
					if (name.hasOwnProperty(key)) {
						self.on(key, name[key]);
					}
				}
			// Callback
			} else if (type(fn) === 'function') {
				var names = name.split(' ');
				for (var n = 0, nl = names.length; n < nl; n++) {
					callbacks[names[n]] = callbacks[names[n]] || [];
					if (callbackIndex(names[n], fn) === -1) {
						callbacks[names[n]].push(fn);
					}
				}
			// Callbacks array
			} else if (type(fn) === 'array') {
				for (var f = 0, fl = fn.length; f < fl; f++) {
					self.on(name, fn[f]);
				}
			}
		};

		/**
		 * Registers callbacks to be executed only once.
		 *
		 * @param  {Mixed} name  Event name, or callbacks map.
		 * @param  {Mixed} fn    Callback, or an array of callback functions.
		 *
		 * @return {Void}
		 */
		self.one = function (name, fn) {
			function proxy() {
				fn.apply(self, arguments);
				self.off(name, proxy);
			}
			self.on(name, proxy);
		};

		/**
		 * Remove one or all callbacks.
		 *
		 * @param  {String} name Event name.
		 * @param  {Mixed}  fn   Callback, or an array of callback functions. Omit to remove all callbacks.
		 *
		 * @return {Void}
		 */
		self.off = function (name, fn) {
			if (fn instanceof Array) {
				for (var f = 0, fl = fn.length; f < fl; f++) {
					self.off(name, fn[f]);
				}
			} else {
				var names = name.split(' ');
				for (var n = 0, nl = names.length; n < nl; n++) {
					callbacks[names[n]] = callbacks[names[n]] || [];
					if (fn == null) {
						callbacks[names[n]].length = 0;
					} else {
						var index = callbackIndex(names[n], fn);
						if (index !== -1) {
							callbacks[names[n]].splice(index, 1);
						}
					}
				}
			}
		};

		/**
		 * Returns callback array index.
		 *
		 * @param  {String}   name Event name.
		 * @param  {Function} fn   Function
		 *
		 * @return {Int} Callback array index, or -1 if isn't registered.
		 */
		function callbackIndex(name, fn) {
			for (var i = 0, l = callbacks[name].length; i < l; i++) {
				if (callbacks[name][i] === fn) {
					return i;
				}
			}
			return -1;
		}

		/**
		 * Reset next cycle timeout.
		 *
		 * @return {Void}
		 */
		function resetCycle() {
			if (dragging.released && !self.isPaused) {
				self.resume();
			}
		}

		/**
		 * Calculate SLIDEE representation of handle position.
		 *
		 * @param  {Int} handlePos
		 *
		 * @return {Int}
		 */
		function handleToSlidee(handlePos) {
			return round(within(handlePos, hPos.start, hPos.end) / hPos.end * (pos.end - pos.start)) + pos.start;
		}

		/**
		 * Keeps track of a dragging delta history.
		 *
		 * @return {Void}
		 */
		function draggingHistoryTick() {
			// Looking at this, I know what you're thinking :) But as we need only 4 history states, doing it this way
			// as opposed to a proper loop is ~25 bytes smaller (when minified with GCC), a lot faster, and doesn't
			// generate garbage. The loop version would create 2 new variables on every tick. Unexaptable!
			dragging.history[0] = dragging.history[1];
			dragging.history[1] = dragging.history[2];
			dragging.history[2] = dragging.history[3];
			dragging.history[3] = dragging.delta;
		}

		/**
		 * Initialize continuous movement.
		 *
		 * @return {Void}
		 */
		function continuousInit(source) {
			dragging.released = 0;
			dragging.source = source;
			dragging.slidee = source === 'slidee';
		}

		/**
		 * Dragging initiator.
		 *
		 * @param  {Event} event
		 *
		 * @return {Void}
		 */
		function dragInit(event) {
			var isTouch = event.type === 'touchstart';
			var source = event.data.source;
			var isSlidee = source === 'slidee';

			// Ignore when already in progress, or interactive element in non-touch navivagion
			if (dragging.init || !isTouch && isInteractive(event.target)) {
				return;
			}

			// Handle dragging conditions
			if (source === 'handle' && (!o.dragHandle || hPos.start === hPos.end)) {
				return;
			}

			// SLIDEE dragging conditions
			if (isSlidee && !(isTouch ? o.touchDragging : o.mouseDragging && event.which < 2)) {
				return;
			}

			if (!isTouch) {
				// prevents native image dragging in Firefox
				stopDefault(event);
			}

			// Reset dragging object
			continuousInit(source);

			// Properties used in dragHandler
			dragging.init = 0;
			dragging.$source = $(event.target);
			dragging.touch = isTouch;
			dragging.pointer = isTouch ? event.originalEvent.touches[0] : event;
			dragging.initX = dragging.pointer.pageX;
			dragging.initY = dragging.pointer.pageY;
			dragging.initPos = isSlidee ? pos.cur : hPos.cur;
			dragging.start = +new Date();
			dragging.time = 0;
			dragging.path = 0;
			dragging.delta = 0;
			dragging.locked = 0;
			dragging.history = [0, 0, 0, 0];
			dragging.pathToLock = isSlidee ? isTouch ? 30 : 10 : 0;

			// Bind dragging events
			$doc.on(isTouch ? dragTouchEvents : dragMouseEvents, dragHandler);

			// Pause ongoing cycle
			self.pause(1);

			// Add dragging class
			(isSlidee ? $slidee : $handle).addClass(o.draggedClass);

			// Trigger moveStart event
			trigger('moveStart');

			// Keep track of a dragging path history. This is later used in the
			// dragging release swing calculation when dragging SLIDEE.
			if (isSlidee) {
				historyID = setInterval(draggingHistoryTick, 10);
			}
		}

		/**
		 * Handler for dragging scrollbar handle or SLIDEE.
		 *
		 * @param  {Event} event
		 *
		 * @return {Void}
		 */
		function dragHandler(event) {
			dragging.released = event.type === 'mouseup' || event.type === 'touchend';
			dragging.pointer = dragging.touch ? event.originalEvent[dragging.released ? 'changedTouches' : 'touches'][0] : event;
			dragging.pathX = dragging.pointer.pageX - dragging.initX;
			dragging.pathY = dragging.pointer.pageY - dragging.initY;
			dragging.path = sqrt(pow(dragging.pathX, 2) + pow(dragging.pathY, 2));
			dragging.delta = o.horizontal ? dragging.pathX : dragging.pathY;

			if (!dragging.released && dragging.path < 1) return;

			// We haven't decided whether this is a drag or not...
			if (!dragging.init) {
				// If the drag path was very short, maybe it's not a drag?
				if (dragging.path < o.dragThreshold) {
					// If the pointer was released, the path will not become longer and it's
					// definitely not a drag. If not released yet, decide on next iteration
					return dragging.released ? dragEnd() : undefined;
				}
				else {
					// If dragging path is sufficiently long we can confidently start a drag
					// if drag is in different direction than scroll, ignore it
					if (o.horizontal ? abs(dragging.pathX) > abs(dragging.pathY) : abs(dragging.pathX) < abs(dragging.pathY)) {
						dragging.init = 1;
					} else {
						return dragEnd();
					}
				}
			}

			stopDefault(event);

			// Disable click on a source element, as it is unwelcome when dragging
			if (!dragging.locked && dragging.path > dragging.pathToLock && dragging.slidee) {
				dragging.locked = 1;
				dragging.$source.on(clickEvent, disableOneEvent);
			}

			// Cancel dragging on release
			if (dragging.released) {
				dragEnd();

				// Adjust path with a swing on mouse release
				if (o.releaseSwing && dragging.slidee) {
					dragging.swing = (dragging.delta - dragging.history[0]) / 40 * 300;
					dragging.delta += dragging.swing;
					dragging.tweese = abs(dragging.swing) > 10;
				}
			}

			slideTo(dragging.slidee ? round(dragging.initPos - dragging.delta) : handleToSlidee(dragging.initPos + dragging.delta));
		}

		/**
		 * Stops dragging and cleans up after it.
		 *
		 * @return {Void}
		 */
		function dragEnd() {
			clearInterval(historyID);
			dragging.released = true;
			$doc.off(dragging.touch ? dragTouchEvents : dragMouseEvents, dragHandler);
			(dragging.slidee ? $slidee : $handle).removeClass(o.draggedClass);

			// Make sure that disableOneEvent is not active in next tick.
			setTimeout(function () {
				dragging.$source.off(clickEvent, disableOneEvent);
			});

			// Normally, this is triggered in render(), but if there
			// is nothing to render, we have to do it manually here.
			if (pos.cur === pos.dest && dragging.init) {
				trigger('moveEnd');
			}

			// Resume ongoing cycle
			self.resume(1);

			dragging.init = 0;
		}

		/**
		 * Check whether element is interactive.
		 *
		 * @return {Boolean}
		 */
		function isInteractive(element) {
			return ~$.inArray(element.nodeName, interactiveElements) || $(element).is(o.interactive);
		}

		/**
		 * Continuous movement cleanup on mouseup.
		 *
		 * @return {Void}
		 */
		function movementReleaseHandler() {
			self.stop();
			$doc.off('mouseup', movementReleaseHandler);
		}

		/**
		 * Buttons navigation handler.
		 *
		 * @param  {Event} event
		 *
		 * @return {Void}
		 */
		function buttonsHandler(event) {
			/*jshint validthis:true */
			stopDefault(event);
			switch (this) {
				case $forwardButton[0]:
				case $backwardButton[0]:
					self.moveBy($forwardButton.is(this) ? o.moveBy : -o.moveBy);
					$doc.on('mouseup', movementReleaseHandler);
					break;

				case $prevButton[0]:
					self.prev();
					break;

				case $nextButton[0]:
					self.next();
					break;

				case $prevPageButton[0]:
					self.prevPage();
					break;

				case $nextPageButton[0]:
					self.nextPage();
					break;
			}
		}

		/**
		 * Mouse wheel delta normalization.
		 *
		 * @param  {Event} event
		 *
		 * @return {Int}
		 */
		function normalizeWheelDelta(event) {
			// wheelDelta needed only for IE8-
			scrolling.curDelta = ((o.horizontal ? event.deltaY || event.deltaX : event.deltaY) || -event.wheelDelta);
			scrolling.curDelta /= event.deltaMode === 1 ? 3 : 100;
			if (!itemNav) {
				return scrolling.curDelta;
			}
			time = +new Date();
			if (scrolling.last < time - scrolling.resetTime) {
				scrolling.delta = 0;
			}
			scrolling.last = time;
			scrolling.delta += scrolling.curDelta;
			if (abs(scrolling.delta) < 1) {
				scrolling.finalDelta = 0;
			} else {
				scrolling.finalDelta = round(scrolling.delta / 1);
				scrolling.delta %= 1;
			}
			return scrolling.finalDelta;
		}

		/**
		 * Mouse scrolling handler.
		 *
		 * @param  {Event} event
		 *
		 * @return {Void}
		 */
		function scrollHandler(event) {
			// Mark event as originating in a Sly instance
			event.originalEvent[namespace] = self;
			// Don't hijack global scrolling
			var time = +new Date();
			if (lastGlobalWheel + o.scrollHijack > time && $scrollSource[0] !== document && $scrollSource[0] !== window) {
				lastGlobalWheel = time;
				return;
			}
			// Ignore if there is no scrolling to be done
			if (!o.scrollBy || pos.start === pos.end) {
				return;
			}
			var delta = normalizeWheelDelta(event.originalEvent);
			// Trap scrolling only when necessary and/or requested
			if (o.scrollTrap || delta > 0 && pos.dest < pos.end || delta < 0 && pos.dest > pos.start) {
				stopDefault(event, 1);
			}
			self.slideBy(o.scrollBy * delta);
		}

		/**
		 * Scrollbar click handler.
		 *
		 * @param  {Event} event
		 *
		 * @return {Void}
		 */
		function scrollbarHandler(event) {
			// Only clicks on scroll bar. Ignore the handle.
			if (o.clickBar && event.target === $sb[0]) {
				stopDefault(event);
				// Calculate new handle position and sync SLIDEE to it
				slideTo(handleToSlidee((o.horizontal ? event.pageX - $sb.offset().left : event.pageY - $sb.offset().top) - handleSize / 2));
			}
		}

		/**
		 * Keyboard input handler.
		 *
		 * @param  {Event} event
		 *
		 * @return {Void}
		 */
		function keyboardHandler(event) {
			if (!o.keyboardNavBy) {
				return;
			}

			switch (event.which) {
				// Left or Up
				case o.horizontal ? 37 : 38:
					stopDefault(event);
					self[o.keyboardNavBy === 'pages' ? 'prevPage' : 'prev']();
					break;

				// Right or Down
				case o.horizontal ? 39 : 40:
					stopDefault(event);
					self[o.keyboardNavBy === 'pages' ? 'nextPage' : 'next']();
					break;
			}
		}

		/**
		 * Click on item activation handler.
		 *
		 * @param  {Event} event
		 *
		 * @return {Void}
		 */
		function activateHandler(event) {
			/*jshint validthis:true */

			// Ignore clicks on interactive elements.
			if (isInteractive(this)) {
				event.originalEvent[namespace + 'ignore'] = true;
				return;
			}

			// Ignore events that:
			// - are not originating from direct SLIDEE children
			// - originated from interactive elements
			if (this.parentNode !== $slidee[0] || event.originalEvent[namespace + 'ignore']) return;

			self.activate(this);
		}

		/**
		 * Click on page button handler.
		 *
		 * @param {Event} event
		 *
		 * @return {Void}
		 */
		function activatePageHandler() {
			/*jshint validthis:true */
			// Accept only events from direct pages bar children.
			if (this.parentNode === $pb[0]) {
				self.activatePage($pages.index(this));
			}
		}

		/**
		 * Pause on hover handler.
		 *
		 * @param  {Event} event
		 *
		 * @return {Void}
		 */
		function pauseOnHoverHandler(event) {
			if (o.pauseOnHover) {
				self[event.type === 'mouseenter' ? 'pause' : 'resume'](2);
			}
		}

		/**
		 * Trigger callbacks for event.
		 *
		 * @param  {String} name Event name.
		 * @param  {Mixed}  argX Arguments passed to callbacks.
		 *
		 * @return {Void}
		 */
		function trigger(name, arg1) {
			if (callbacks[name]) {
				l = callbacks[name].length;
				// Callbacks will be stored and executed from a temporary array to not
				// break the execution queue when one of the callbacks unbinds itself.
				tmpArray.length = 0;
				for (i = 0; i < l; i++) {
					tmpArray.push(callbacks[name][i]);
				}
				// Execute the callbacks
				for (i = 0; i < l; i++) {
					tmpArray[i].call(self, name, arg1);
				}
			}
		}

		/**
		 * Destroys instance and everything it created.
		 *
		 * @return {Void}
		 */
		self.destroy = function () {
			// Remove the reference to itself
			Sly.removeInstance(frame);

			// Unbind all events
			$scrollSource
				.add($handle)
				.add($sb)
				.add($pb)
				.add($forwardButton)
				.add($backwardButton)
				.add($prevButton)
				.add($nextButton)
				.add($prevPageButton)
				.add($nextPageButton)
				.off('.' + namespace);

			// Unbinding specifically as to not nuke out other instances
			$doc.off('keydown', keyboardHandler);

			// Remove classes
			$prevButton
				.add($nextButton)
				.add($prevPageButton)
				.add($nextPageButton)
				.removeClass(o.disabledClass);

			if ($items && rel.activeItem != null) {
				$items.eq(rel.activeItem).removeClass(o.activeClass);
			}

			// Remove page items
			$pb.empty();

			if (!parallax) {
				// Unbind events from frame
				$frame.off('.' + namespace);
				// Restore original styles
				frameStyles.restore();
				slideeStyles.restore();
				sbStyles.restore();
				handleStyles.restore();
				// Remove the instance from element data storage
				$.removeData(frame, namespace);
			}

			// Clean up collections
			items.length = pages.length = 0;
			last = {};

			// Reset initialized status and return the instance
			self.initialized = 0;
			return self;
		};

		/**
		 * Initialize.
		 *
		 * @return {Object}
		 */
		self.init = function () {
			if (self.initialized) {
				return;
			}

			// Disallow multiple instances on the same element
			if (Sly.getInstance(frame)) throw new Error('There is already a Sly instance on this element');

			// Store the reference to itself
			Sly.storeInstance(frame, self);

			// Register callbacks map
			self.on(callbackMap);

			// Save styles
			var holderProps = ['overflow', 'position'];
			var movableProps = ['position', 'webkitTransform', 'msTransform', 'transform', 'left', 'top', 'width', 'height'];
			frameStyles.save.apply(frameStyles, holderProps);
			sbStyles.save.apply(sbStyles, holderProps);
			slideeStyles.save.apply(slideeStyles, movableProps);
			handleStyles.save.apply(handleStyles, movableProps);

			// Set required styles
			var $movables = $handle;
			if (!parallax) {
				$movables = $movables.add($slidee);
				$frame.css('overflow', 'hidden');
				if (!transform && $frame.css('position') === 'static') {
					$frame.css('position', 'relative');
				}
			}
			if (transform) {
				if (gpuAcceleration) {
					$movables.css(transform, gpuAcceleration);
				}
			} else {
				if ($sb.css('position') === 'static') {
					$sb.css('position', 'relative');
				}
				$movables.css({ position: 'absolute' });
			}

			// Navigation buttons
			if (o.forward) {
				$forwardButton.on(mouseDownEvent, buttonsHandler);
			}
			if (o.backward) {
				$backwardButton.on(mouseDownEvent, buttonsHandler);
			}
			if (o.prev) {
				$prevButton.on(clickEvent, buttonsHandler);
			}
			if (o.next) {
				$nextButton.on(clickEvent, buttonsHandler);
			}
			if (o.prevPage) {
				$prevPageButton.on(clickEvent, buttonsHandler);
			}
			if (o.nextPage) {
				$nextPageButton.on(clickEvent, buttonsHandler);
			}

			// Scrolling navigation
			$scrollSource.on(wheelEvent, scrollHandler);

			// Clicking on scrollbar navigation
			if ($sb[0]) {
				$sb.on(clickEvent, scrollbarHandler);
			}

			// Click on items navigation
			if (itemNav && o.activateOn) {
				$frame.on(o.activateOn + '.' + namespace, '*', activateHandler);
			}

			// Pages navigation
			if ($pb[0] && o.activatePageOn) {
				$pb.on(o.activatePageOn + '.' + namespace, '*', activatePageHandler);
			}

			// Dragging navigation
			$dragSource.on(dragInitEvents, { source: 'slidee' }, dragInit);

			// Scrollbar dragging navigation
			if ($handle) {
				$handle.on(dragInitEvents, { source: 'handle' }, dragInit);
			}

			// Keyboard navigation
			$doc.on('keydown', keyboardHandler);

			if (!parallax) {
				// Pause on hover
				$frame.on('mouseenter.' + namespace + ' mouseleave.' + namespace, pauseOnHoverHandler);
				// Reset native FRAME element scroll
				$frame.on('scroll.' + namespace, resetScroll);
			}

			// Mark instance as initialized
			self.initialized = 1;

			// Load
			load(true);

			// Initiate automatic cycling
			if (o.cycleBy && !parallax) {
				self[o.startPaused ? 'pause' : 'resume']();
			}

			// Return instance
			return self;
		};
	}

	Sly.getInstance = function (element) {
		return $.data(element, namespace);
	};

	Sly.storeInstance = function (element, sly) {
		return $.data(element, namespace, sly);
	};

	Sly.removeInstance = function (element) {
		return $.removeData(element, namespace);
	};

	/**
	 * Return type of the value.
	 *
	 * @param  {Mixed} value
	 *
	 * @return {String}
	 */
	function type(value) {
		if (value == null) {
			return String(value);
		}

		if (typeof value === 'object' || typeof value === 'function') {
			return Object.prototype.toString.call(value).match(/\s([a-z]+)/i)[1].toLowerCase() || 'object';
		}

		return typeof value;
	}

	/**
	 * Event preventDefault & stopPropagation helper.
	 *
	 * @param {Event} event     Event object.
	 * @param {Bool}  noBubbles Cancel event bubbling.
	 *
	 * @return {Void}
	 */
	function stopDefault(event, noBubbles) {
		event.preventDefault();
		if (noBubbles) {
			event.stopPropagation();
		}
	}

	/**
	 * Disables an event it was triggered on and unbinds itself.
	 *
	 * @param  {Event} event
	 *
	 * @return {Void}
	 */
	function disableOneEvent(event) {
		/*jshint validthis:true */
		stopDefault(event, 1);
		$(this).off(event.type, disableOneEvent);
	}

	/**
	 * Resets native element scroll values to 0.
	 *
	 * @return {Void}
	 */
	function resetScroll() {
		/*jshint validthis:true */
		this.scrollLeft = 0;
		this.scrollTop = 0;
	}

	/**
	 * Check if variable is a number.
	 *
	 * @param {Mixed} value
	 *
	 * @return {Boolean}
	 */
	function isNumber(value) {
		return !isNaN(parseFloat(value)) && isFinite(value);
	}

	/**
	 * Parse style to pixels.
	 *
	 * @param {Object}   $item    jQuery object with element.
	 * @param {Property} property CSS property to get the pixels from.
	 *
	 * @return {Int}
	 */
	function getPx($item, property) {
		return 0 | round(String($item.css(property)).replace(/[^\-0-9.]/g, ''));
	}

	/**
	 * Make sure that number is within the limits.
	 *
	 * @param {Number} number
	 * @param {Number} min
	 * @param {Number} max
	 *
	 * @return {Number}
	 */
	function within(number, min, max) {
		return number < min ? min : number > max ? max : number;
	}

	/**
	 * Saves element styles for later restoration.
	 *
	 * Example:
	 *   var styles = new StyleRestorer(frame);
	 *   styles.save('position');
	 *   element.style.position = 'absolute';
	 *   styles.restore(); // restores to state before the assignment above
	 *
	 * @param {Element} element
	 */
	function StyleRestorer(element) {
		var self = {};
		self.style = {};
		self.save = function () {
			if (!element || !element.nodeType) return;
			for (var i = 0; i < arguments.length; i++) {
				self.style[arguments[i]] = element.style[arguments[i]];
			}
			return self;
		};
		self.restore = function () {
			if (!element || !element.nodeType) return;
			for (var prop in self.style) {
				if (self.style.hasOwnProperty(prop)) element.style[prop] = self.style[prop];
			}
			return self;
		};
		return self;
	}

	// Local WindowAnimationTiming interface polyfill
	(function (w) {
		rAF = w.requestAnimationFrame
			|| w.webkitRequestAnimationFrame
			|| fallback;

		/**
		* Fallback implementation.
		*/
		var prev = new Date().getTime();
		function fallback(fn) {
			var curr = new Date().getTime();
			var ms = Math.max(0, 16 - (curr - prev));
			var req = setTimeout(fn, ms);
			prev = curr;
			return req;
		}

		/**
		* Cancel.
		*/
		var cancel = w.cancelAnimationFrame
			|| w.webkitCancelAnimationFrame
			|| w.clearTimeout;

		cAF = function(id){
			cancel.call(w, id);
		};
	}(window));

	// Feature detects
	(function () {
		var prefixes = ['', 'Webkit', 'Moz', 'ms', 'O'];
		var el = document.createElement('div');

		function testProp(prop) {
			for (var p = 0, pl = prefixes.length; p < pl; p++) {
				var prefixedProp = prefixes[p] ? prefixes[p] + prop.charAt(0).toUpperCase() + prop.slice(1) : prop;
				if (el.style[prefixedProp] != null) {
					return prefixedProp;
				}
			}
		}

		// Global support indicators
		transform = testProp('transform');
		gpuAcceleration = testProp('perspective') ? 'translateZ(0) ' : '';
	}());

	// Expose class globally
	w[className] = Sly;

	// jQuery proxy
	$.fn[pluginName] = function (options, callbackMap) {
		var method, methodArgs;

		// Attributes logic
		if (!$.isPlainObject(options)) {
			if (type(options) === 'string' || options === false) {
				method = options === false ? 'destroy' : options;
				methodArgs = Array.prototype.slice.call(arguments, 1);
			}
			options = {};
		}

		// Apply to all elements
		return this.each(function (i, element) {
			// Call with prevention against multiple instantiations
			var plugin = Sly.getInstance(element);

			if (!plugin && !method) {
				// Create a new object if it doesn't exist yet
				plugin = new Sly(element, options, callbackMap).init();
			} else if (plugin && method) {
				// Call method
				if (plugin[method]) {
					plugin[method].apply(plugin, methodArgs);
				}
			}
		});
	};

	// Default options
	Sly.defaults = {
		slidee:     null,  // Selector, DOM element, or jQuery object with DOM element representing SLIDEE.
		horizontal: false, // Switch to horizontal mode.

		// Item based navigation
		itemNav:        null,  // Item navigation type. Can be: 'basic', 'centered', 'forceCentered'.
		itemSelector:   null,  // Select only items that match this selector.
		smart:          false, // Repositions the activated item to help with further navigation.
		activateOn:     null,  // Activate an item on this event. Can be: 'click', 'mouseenter', ...
		activateMiddle: false, // Always activate the item in the middle of the FRAME. forceCentered only.

		// Scrolling
		scrollSource: null,  // Element for catching the mouse wheel scrolling. Default is FRAME.
		scrollBy:     0,     // Pixels or items to move per one mouse scroll. 0 to disable scrolling.
		scrollHijack: 300,   // Milliseconds since last wheel event after which it is acceptable to hijack global scroll.
		scrollTrap:   false, // Don't bubble scrolling when hitting scrolling limits.

		// Dragging
		dragSource:    null,  // Selector or DOM element for catching dragging events. Default is FRAME.
		mouseDragging: false, // Enable navigation by dragging the SLIDEE with mouse cursor.
		touchDragging: false, // Enable navigation by dragging the SLIDEE with touch events.
		releaseSwing:  false, // Ease out on dragging swing release.
		swingSpeed:    0.2,   // Swing synchronization speed, where: 1 = instant, 0 = infinite.
		elasticBounds: false, // Stretch SLIDEE position limits when dragging past FRAME boundaries.
		dragThreshold: 3,     // Distance in pixels before Sly recognizes dragging.
		interactive:   null,  // Selector for special interactive elements.

		// Scrollbar
		scrollBar:     null,  // Selector or DOM element for scrollbar container.
		dragHandle:    false, // Whether the scrollbar handle should be draggable.
		dynamicHandle: false, // Scrollbar handle represents the ratio between hidden and visible content.
		minHandleSize: 50,    // Minimal height or width (depends on sly direction) of a handle in pixels.
		clickBar:      false, // Enable navigation by clicking on scrollbar.
		syncSpeed:     0.5,   // Handle => SLIDEE synchronization speed, where: 1 = instant, 0 = infinite.

		// Pagesbar
		pagesBar:       null, // Selector or DOM element for pages bar container.
		activatePageOn: null, // Event used to activate page. Can be: click, mouseenter, ...
		pageBuilder:          // Page item generator.
			function (index) {
				return '<li>' + (index + 1) + '</li>';
			},

		// Navigation buttons
		forward:  null, // Selector or DOM element for "forward movement" button.
		backward: null, // Selector or DOM element for "backward movement" button.
		prev:     null, // Selector or DOM element for "previous item" button.
		next:     null, // Selector or DOM element for "next item" button.
		prevPage: null, // Selector or DOM element for "previous page" button.
		nextPage: null, // Selector or DOM element for "next page" button.

		// Automated cycling
		cycleBy:       null,  // Enable automatic cycling by 'items' or 'pages'.
		cycleInterval: 5000,  // Delay between cycles in milliseconds.
		pauseOnHover:  false, // Pause cycling when mouse hovers over the FRAME.
		startPaused:   false, // Whether to start in paused sate.

		// Mixed options
		moveBy:        300,     // Speed in pixels per second used by forward and backward buttons.
		speed:         0,       // Animations speed in milliseconds. 0 to disable animations.
		easing:        'swing', // Easing for duration based (tweening) animations.
		startAt:       null,    // Starting offset in pixels or items.
		keyboardNavBy: null,    // Enable keyboard navigation by 'items' or 'pages'.

		// Classes
		draggedClass:  'dragged', // Class for dragged elements (like SLIDEE or scrollbar handle).
		activeClass:   'active',  // Class for active items and pages.
		disabledClass: 'disabled' // Class for disabled navigation elements.
	};
}(jQuery, window));

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJzbHkuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyohXG4gKiBzbHkgMS42LjEgLSA4dGggQXVnIDIwMTVcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9kYXJzYWluL3NseVxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cbiAqIGh0dHA6Ly9vcGVuc291cmNlLm9yZy9saWNlbnNlcy9NSVRcbiAqL1xuXG47KGZ1bmN0aW9uICgkLCB3LCB1bmRlZmluZWQpIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdHZhciBwbHVnaW5OYW1lID0gJ3NseSc7XG5cdHZhciBjbGFzc05hbWUgID0gJ1NseSc7XG5cdHZhciBuYW1lc3BhY2UgID0gcGx1Z2luTmFtZTtcblxuXHQvLyBMb2NhbCBXaW5kb3dBbmltYXRpb25UaW1pbmcgaW50ZXJmYWNlXG5cdHZhciBjQUYgPSB3LmNhbmNlbEFuaW1hdGlvbkZyYW1lIHx8IHcuY2FuY2VsUmVxdWVzdEFuaW1hdGlvbkZyYW1lO1xuXHR2YXIgckFGID0gdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWU7XG5cblx0Ly8gU3VwcG9ydCBpbmRpY2F0b3JzXG5cdHZhciB0cmFuc2Zvcm0sIGdwdUFjY2VsZXJhdGlvbjtcblxuXHQvLyBPdGhlciBnbG9iYWwgdmFsdWVzXG5cdHZhciAkZG9jID0gJChkb2N1bWVudCk7XG5cdHZhciBkcmFnSW5pdEV2ZW50cyA9ICd0b3VjaHN0YXJ0LicgKyBuYW1lc3BhY2UgKyAnIG1vdXNlZG93bi4nICsgbmFtZXNwYWNlO1xuXHR2YXIgZHJhZ01vdXNlRXZlbnRzID0gJ21vdXNlbW92ZS4nICsgbmFtZXNwYWNlICsgJyBtb3VzZXVwLicgKyBuYW1lc3BhY2U7XG5cdHZhciBkcmFnVG91Y2hFdmVudHMgPSAndG91Y2htb3ZlLicgKyBuYW1lc3BhY2UgKyAnIHRvdWNoZW5kLicgKyBuYW1lc3BhY2U7XG5cdHZhciB3aGVlbEV2ZW50ID0gKGRvY3VtZW50LmltcGxlbWVudGF0aW9uLmhhc0ZlYXR1cmUoJ0V2ZW50LndoZWVsJywgJzMuMCcpID8gJ3doZWVsLicgOiAnbW91c2V3aGVlbC4nKSArIG5hbWVzcGFjZTtcblx0dmFyIGNsaWNrRXZlbnQgPSAnY2xpY2suJyArIG5hbWVzcGFjZTtcblx0dmFyIG1vdXNlRG93bkV2ZW50ID0gJ21vdXNlZG93bi4nICsgbmFtZXNwYWNlO1xuXHR2YXIgaW50ZXJhY3RpdmVFbGVtZW50cyA9IFsnSU5QVVQnLCAnU0VMRUNUJywgJ0JVVFRPTicsICdURVhUQVJFQSddO1xuXHR2YXIgdG1wQXJyYXkgPSBbXTtcblx0dmFyIHRpbWU7XG5cblx0Ly8gTWF0aCBzaG9ydGhhbmRzXG5cdHZhciBhYnMgPSBNYXRoLmFicztcblx0dmFyIHNxcnQgPSBNYXRoLnNxcnQ7XG5cdHZhciBwb3cgPSBNYXRoLnBvdztcblx0dmFyIHJvdW5kID0gTWF0aC5yb3VuZDtcblx0dmFyIG1heCA9IE1hdGgubWF4O1xuXHR2YXIgbWluID0gTWF0aC5taW47XG5cblx0Ly8gS2VlcCB0cmFjayBvZiBsYXN0IGZpcmVkIGdsb2JhbCB3aGVlbCBldmVudFxuXHR2YXIgbGFzdEdsb2JhbFdoZWVsID0gMDtcblx0JGRvYy5vbih3aGVlbEV2ZW50LCBmdW5jdGlvbiAoZXZlbnQpIHtcblx0XHR2YXIgc2x5ID0gZXZlbnQub3JpZ2luYWxFdmVudFtuYW1lc3BhY2VdO1xuXHRcdHZhciB0aW1lID0gK25ldyBEYXRlKCk7XG5cdFx0Ly8gVXBkYXRlIGxhc3QgZ2xvYmFsIHdoZWVsIHRpbWUsIGJ1dCBvbmx5IHdoZW4gZXZlbnQgZGlkbid0IG9yaWdpbmF0ZVxuXHRcdC8vIGluIFNseSBmcmFtZSwgb3IgdGhlIG9yaWdpbiB3YXMgbGVzcyB0aGFuIHNjcm9sbEhpamFjayB0aW1lIGFnb1xuXHRcdGlmICghc2x5IHx8IHNseS5vcHRpb25zLnNjcm9sbEhpamFjayA8IHRpbWUgLSBsYXN0R2xvYmFsV2hlZWwpIGxhc3RHbG9iYWxXaGVlbCA9IHRpbWU7XG5cdH0pO1xuXG5cdC8qKlxuXHQgKiBTbHkuXG5cdCAqXG5cdCAqIEBjbGFzc1xuXHQgKlxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IGZyYW1lICAgICAgIERPTSBlbGVtZW50IG9mIHNseSBjb250YWluZXIuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgb3B0aW9ucyAgICAgT2JqZWN0IHdpdGggb3B0aW9ucy5cblx0ICogQHBhcmFtIHtPYmplY3R9ICBjYWxsYmFja01hcCBDYWxsYmFja3MgbWFwLlxuXHQgKi9cblx0ZnVuY3Rpb24gU2x5KGZyYW1lLCBvcHRpb25zLCBjYWxsYmFja01hcCkge1xuXHRcdGlmICghKHRoaXMgaW5zdGFuY2VvZiBTbHkpKSByZXR1cm4gbmV3IFNseShmcmFtZSwgb3B0aW9ucywgY2FsbGJhY2tNYXApO1xuXG5cdFx0Ly8gRXh0ZW5kIG9wdGlvbnNcblx0XHR2YXIgbyA9ICQuZXh0ZW5kKHt9LCBTbHkuZGVmYXVsdHMsIG9wdGlvbnMpO1xuXG5cdFx0Ly8gUHJpdmF0ZSB2YXJpYWJsZXNcblx0XHR2YXIgc2VsZiA9IHRoaXM7XG5cdFx0dmFyIHBhcmFsbGF4ID0gaXNOdW1iZXIoZnJhbWUpO1xuXG5cdFx0Ly8gRnJhbWVcblx0XHR2YXIgJGZyYW1lID0gJChmcmFtZSk7XG5cdFx0dmFyICRzbGlkZWUgPSBvLnNsaWRlZSA/ICQoby5zbGlkZWUpLmVxKDApIDogJGZyYW1lLmNoaWxkcmVuKCkuZXEoMCk7XG5cdFx0dmFyIGZyYW1lU2l6ZSA9IDA7XG5cdFx0dmFyIHNsaWRlZVNpemUgPSAwO1xuXHRcdHZhciBwb3MgPSB7XG5cdFx0XHRzdGFydDogMCxcblx0XHRcdGNlbnRlcjogMCxcblx0XHRcdGVuZDogMCxcblx0XHRcdGN1cjogMCxcblx0XHRcdGRlc3Q6IDBcblx0XHR9O1xuXG5cdFx0Ly8gU2Nyb2xsYmFyXG5cdFx0dmFyICRzYiA9ICQoby5zY3JvbGxCYXIpLmVxKDApO1xuXHRcdHZhciAkaGFuZGxlID0gJHNiLmNoaWxkcmVuKCkuZXEoMCk7XG5cdFx0dmFyIHNiU2l6ZSA9IDA7XG5cdFx0dmFyIGhhbmRsZVNpemUgPSAwO1xuXHRcdHZhciBoUG9zID0ge1xuXHRcdFx0c3RhcnQ6IDAsXG5cdFx0XHRlbmQ6IDAsXG5cdFx0XHRjdXI6IDBcblx0XHR9O1xuXG5cdFx0Ly8gUGFnZXNiYXJcblx0XHR2YXIgJHBiID0gJChvLnBhZ2VzQmFyKTtcblx0XHR2YXIgJHBhZ2VzID0gMDtcblx0XHR2YXIgcGFnZXMgPSBbXTtcblxuXHRcdC8vIEl0ZW1zXG5cdFx0dmFyICRpdGVtcyA9IDA7XG5cdFx0dmFyIGl0ZW1zID0gW107XG5cdFx0dmFyIHJlbCA9IHtcblx0XHRcdGZpcnN0SXRlbTogMCxcblx0XHRcdGxhc3RJdGVtOiAwLFxuXHRcdFx0Y2VudGVySXRlbTogMCxcblx0XHRcdGFjdGl2ZUl0ZW06IG51bGwsXG5cdFx0XHRhY3RpdmVQYWdlOiAwXG5cdFx0fTtcblxuXHRcdC8vIFN0eWxlc1xuXHRcdHZhciBmcmFtZVN0eWxlcyA9IG5ldyBTdHlsZVJlc3RvcmVyKCRmcmFtZVswXSk7XG5cdFx0dmFyIHNsaWRlZVN0eWxlcyA9IG5ldyBTdHlsZVJlc3RvcmVyKCRzbGlkZWVbMF0pO1xuXHRcdHZhciBzYlN0eWxlcyA9IG5ldyBTdHlsZVJlc3RvcmVyKCRzYlswXSk7XG5cdFx0dmFyIGhhbmRsZVN0eWxlcyA9IG5ldyBTdHlsZVJlc3RvcmVyKCRoYW5kbGVbMF0pO1xuXG5cdFx0Ly8gTmF2aWdhdGlvbiB0eXBlIGJvb2xlYW5zXG5cdFx0dmFyIGJhc2ljTmF2ID0gby5pdGVtTmF2ID09PSAnYmFzaWMnO1xuXHRcdHZhciBmb3JjZUNlbnRlcmVkTmF2ID0gby5pdGVtTmF2ID09PSAnZm9yY2VDZW50ZXJlZCc7XG5cdFx0dmFyIGNlbnRlcmVkTmF2ID0gby5pdGVtTmF2ID09PSAnY2VudGVyZWQnIHx8IGZvcmNlQ2VudGVyZWROYXY7XG5cdFx0dmFyIGl0ZW1OYXYgPSAhcGFyYWxsYXggJiYgKGJhc2ljTmF2IHx8IGNlbnRlcmVkTmF2IHx8IGZvcmNlQ2VudGVyZWROYXYpO1xuXG5cdFx0Ly8gTWlzY2VsbGFuZW91c1xuXHRcdHZhciAkc2Nyb2xsU291cmNlID0gby5zY3JvbGxTb3VyY2UgPyAkKG8uc2Nyb2xsU291cmNlKSA6ICRmcmFtZTtcblx0XHR2YXIgJGRyYWdTb3VyY2UgPSBvLmRyYWdTb3VyY2UgPyAkKG8uZHJhZ1NvdXJjZSkgOiAkZnJhbWU7XG5cdFx0dmFyICRmb3J3YXJkQnV0dG9uID0gJChvLmZvcndhcmQpO1xuXHRcdHZhciAkYmFja3dhcmRCdXR0b24gPSAkKG8uYmFja3dhcmQpO1xuXHRcdHZhciAkcHJldkJ1dHRvbiA9ICQoby5wcmV2KTtcblx0XHR2YXIgJG5leHRCdXR0b24gPSAkKG8ubmV4dCk7XG5cdFx0dmFyICRwcmV2UGFnZUJ1dHRvbiA9ICQoby5wcmV2UGFnZSk7XG5cdFx0dmFyICRuZXh0UGFnZUJ1dHRvbiA9ICQoby5uZXh0UGFnZSk7XG5cdFx0dmFyIGNhbGxiYWNrcyA9IHt9O1xuXHRcdHZhciBsYXN0ID0ge307XG5cdFx0dmFyIGFuaW1hdGlvbiA9IHt9O1xuXHRcdHZhciBtb3ZlID0ge307XG5cdFx0dmFyIGRyYWdnaW5nID0ge1xuXHRcdFx0cmVsZWFzZWQ6IDFcblx0XHR9O1xuXHRcdHZhciBzY3JvbGxpbmcgPSB7XG5cdFx0XHRsYXN0OiAwLFxuXHRcdFx0ZGVsdGE6IDAsXG5cdFx0XHRyZXNldFRpbWU6IDIwMFxuXHRcdH07XG5cdFx0dmFyIHJlbmRlcklEID0gMDtcblx0XHR2YXIgaGlzdG9yeUlEID0gMDtcblx0XHR2YXIgY3ljbGVJRCA9IDA7XG5cdFx0dmFyIGNvbnRpbnVvdXNJRCA9IDA7XG5cdFx0dmFyIGksIGw7XG5cblx0XHQvLyBOb3JtYWxpemluZyBmcmFtZVxuXHRcdGlmICghcGFyYWxsYXgpIHtcblx0XHRcdGZyYW1lID0gJGZyYW1lWzBdO1xuXHRcdH1cblxuXHRcdC8vIEV4cG9zZSBwcm9wZXJ0aWVzXG5cdFx0c2VsZi5pbml0aWFsaXplZCA9IDA7XG5cdFx0c2VsZi5mcmFtZSA9IGZyYW1lO1xuXHRcdHNlbGYuc2xpZGVlID0gJHNsaWRlZVswXTtcblx0XHRzZWxmLnBvcyA9IHBvcztcblx0XHRzZWxmLnJlbCA9IHJlbDtcblx0XHRzZWxmLml0ZW1zID0gaXRlbXM7XG5cdFx0c2VsZi5wYWdlcyA9IHBhZ2VzO1xuXHRcdHNlbGYuaXNQYXVzZWQgPSAwO1xuXHRcdHNlbGYub3B0aW9ucyA9IG87XG5cdFx0c2VsZi5kcmFnZ2luZyA9IGRyYWdnaW5nO1xuXG5cdFx0LyoqXG5cdFx0ICogTG9hZGluZyBmdW5jdGlvbi5cblx0XHQgKlxuXHRcdCAqIFBvcHVsYXRlIGFycmF5cywgc2V0IHNpemVzLCBiaW5kIGV2ZW50cywgLi4uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0Jvb2xlYW59IFtpc0luaXRdIFdoZXRoZXIgbG9hZCBpcyBjYWxsZWQgZnJvbSB3aXRoaW4gc2VsZi5pbml0KCkuXG5cdFx0ICogQHJldHVybiB7Vm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBsb2FkKGlzSW5pdCkge1xuXHRcdFx0Ly8gTG9jYWwgdmFyaWFibGVzXG5cdFx0XHR2YXIgbGFzdEl0ZW1zQ291bnQgPSAwO1xuXHRcdFx0dmFyIGxhc3RQYWdlc0NvdW50ID0gcGFnZXMubGVuZ3RoO1xuXG5cdFx0XHQvLyBTYXZlIG9sZCBwb3NpdGlvblxuXHRcdFx0cG9zLm9sZCA9ICQuZXh0ZW5kKHt9LCBwb3MpO1xuXG5cdFx0XHQvLyBSZXNldCBnbG9iYWwgdmFyaWFibGVzXG5cdFx0XHRmcmFtZVNpemUgPSBwYXJhbGxheCA/IDAgOiAkZnJhbWVbby5ob3Jpem9udGFsID8gJ3dpZHRoJyA6ICdoZWlnaHQnXSgpO1xuXHRcdFx0c2JTaXplID0gJHNiW28uaG9yaXpvbnRhbCA/ICd3aWR0aCcgOiAnaGVpZ2h0J10oKTtcblx0XHRcdHNsaWRlZVNpemUgPSBwYXJhbGxheCA/IGZyYW1lIDogJHNsaWRlZVtvLmhvcml6b250YWwgPyAnb3V0ZXJXaWR0aCcgOiAnb3V0ZXJIZWlnaHQnXSgpO1xuXHRcdFx0cGFnZXMubGVuZ3RoID0gMDtcblxuXHRcdFx0Ly8gU2V0IHBvc2l0aW9uIGxpbWl0cyAmIHJlbGF0aXZlc1xuXHRcdFx0cG9zLnN0YXJ0ID0gMDtcblx0XHRcdHBvcy5lbmQgPSBtYXgoc2xpZGVlU2l6ZSAtIGZyYW1lU2l6ZSwgMCk7XG5cblx0XHRcdC8vIFNpemVzICYgb2Zmc2V0cyBmb3IgaXRlbSBiYXNlZCBuYXZpZ2F0aW9uc1xuXHRcdFx0aWYgKGl0ZW1OYXYpIHtcblx0XHRcdFx0Ly8gU2F2ZSB0aGUgbnVtYmVyIG9mIGN1cnJlbnQgaXRlbXNcblx0XHRcdFx0bGFzdEl0ZW1zQ291bnQgPSBpdGVtcy5sZW5ndGg7XG5cblx0XHRcdFx0Ly8gUmVzZXQgaXRlbU5hdiByZWxhdGVkIHZhcmlhYmxlc1xuXHRcdFx0XHQkaXRlbXMgPSAkc2xpZGVlLmNoaWxkcmVuKG8uaXRlbVNlbGVjdG9yKTtcblx0XHRcdFx0aXRlbXMubGVuZ3RoID0gMDtcblxuXHRcdFx0XHQvLyBOZWVkZWQgdmFyaWFibGVzXG5cdFx0XHRcdHZhciBwYWRkaW5nU3RhcnQgPSBnZXRQeCgkc2xpZGVlLCBvLmhvcml6b250YWwgPyAncGFkZGluZ0xlZnQnIDogJ3BhZGRpbmdUb3AnKTtcblx0XHRcdFx0dmFyIHBhZGRpbmdFbmQgPSBnZXRQeCgkc2xpZGVlLCBvLmhvcml6b250YWwgPyAncGFkZGluZ1JpZ2h0JyA6ICdwYWRkaW5nQm90dG9tJyk7XG5cdFx0XHRcdHZhciBib3JkZXJCb3ggPSAkKCRpdGVtcykuY3NzKCdib3hTaXppbmcnKSA9PT0gJ2JvcmRlci1ib3gnO1xuXHRcdFx0XHR2YXIgYXJlRmxvYXRlZCA9ICRpdGVtcy5jc3MoJ2Zsb2F0JykgIT09ICdub25lJztcblx0XHRcdFx0dmFyIGlnbm9yZWRNYXJnaW4gPSAwO1xuXHRcdFx0XHR2YXIgbGFzdEl0ZW1JbmRleCA9ICRpdGVtcy5sZW5ndGggLSAxO1xuXHRcdFx0XHR2YXIgbGFzdEl0ZW07XG5cblx0XHRcdFx0Ly8gUmVzZXQgc2xpZGVlU2l6ZVxuXHRcdFx0XHRzbGlkZWVTaXplID0gMDtcblxuXHRcdFx0XHQvLyBJdGVyYXRlIHRocm91Z2ggaXRlbXNcblx0XHRcdFx0JGl0ZW1zLmVhY2goZnVuY3Rpb24gKGksIGVsZW1lbnQpIHtcblx0XHRcdFx0XHQvLyBJdGVtXG5cdFx0XHRcdFx0dmFyICRpdGVtID0gJChlbGVtZW50KTtcblx0XHRcdFx0XHR2YXIgcmVjdCA9IGVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRcdFx0dmFyIGl0ZW1TaXplID0gcm91bmQoby5ob3Jpem9udGFsID8gcmVjdC53aWR0aCB8fCByZWN0LnJpZ2h0IC0gcmVjdC5sZWZ0IDogcmVjdC5oZWlnaHQgfHwgcmVjdC5ib3R0b20gLSByZWN0LnRvcCk7XG5cdFx0XHRcdFx0dmFyIGl0ZW1NYXJnaW5TdGFydCA9IGdldFB4KCRpdGVtLCBvLmhvcml6b250YWwgPyAnbWFyZ2luTGVmdCcgOiAnbWFyZ2luVG9wJyk7XG5cdFx0XHRcdFx0dmFyIGl0ZW1NYXJnaW5FbmQgPSBnZXRQeCgkaXRlbSwgby5ob3Jpem9udGFsID8gJ21hcmdpblJpZ2h0JyA6ICdtYXJnaW5Cb3R0b20nKTtcblx0XHRcdFx0XHR2YXIgaXRlbVNpemVGdWxsID0gaXRlbVNpemUgKyBpdGVtTWFyZ2luU3RhcnQgKyBpdGVtTWFyZ2luRW5kO1xuXHRcdFx0XHRcdHZhciBzaW5nbGVTcGFjZWQgPSAhaXRlbU1hcmdpblN0YXJ0IHx8ICFpdGVtTWFyZ2luRW5kO1xuXHRcdFx0XHRcdHZhciBpdGVtID0ge307XG5cdFx0XHRcdFx0aXRlbS5lbCA9IGVsZW1lbnQ7XG5cdFx0XHRcdFx0aXRlbS5zaXplID0gc2luZ2xlU3BhY2VkID8gaXRlbVNpemUgOiBpdGVtU2l6ZUZ1bGw7XG5cdFx0XHRcdFx0aXRlbS5oYWxmID0gaXRlbS5zaXplIC8gNDtcblx0XHRcdFx0XHRpdGVtLnN0YXJ0ID0gc2xpZGVlU2l6ZSArIChzaW5nbGVTcGFjZWQgPyBpdGVtTWFyZ2luU3RhcnQgOiAwKTtcblx0XHRcdFx0XHRpdGVtLmNlbnRlciA9IGl0ZW0uc3RhcnQgLSByb3VuZChmcmFtZVNpemUgLyA0IC0gaXRlbS5zaXplIC8gNCk7XG5cdFx0XHRcdFx0aXRlbS5lbmQgPSBpdGVtLnN0YXJ0IC0gZnJhbWVTaXplICsgaXRlbS5zaXplO1xuXG5cdFx0XHRcdFx0Ly8gQWNjb3VudCBmb3Igc2xpZGVlIHBhZGRpbmdcblx0XHRcdFx0XHRpZiAoIWkpIHtcblx0XHRcdFx0XHRcdHNsaWRlZVNpemUgKz0gcGFkZGluZ1N0YXJ0O1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIEluY3JlbWVudCBzbGlkZWUgc2l6ZSBmb3Igc2l6ZSBvZiB0aGUgYWN0aXZlIGVsZW1lbnRcblx0XHRcdFx0XHRzbGlkZWVTaXplICs9IGl0ZW1TaXplRnVsbDtcblxuXHRcdFx0XHRcdC8vIFRyeSB0byBhY2NvdW50IGZvciB2ZXJ0aWNhbCBtYXJnaW4gY29sbGFwc2luZyBpbiB2ZXJ0aWNhbCBtb2RlXG5cdFx0XHRcdFx0Ly8gSXQncyBub3QgYnVsbGV0cHJvb2YsIGJ1dCBzaG91bGQgd29yayBpbiA5OSUgb2YgY2FzZXNcblx0XHRcdFx0XHRpZiAoIW8uaG9yaXpvbnRhbCAmJiAhYXJlRmxvYXRlZCkge1xuXHRcdFx0XHRcdFx0Ly8gU3VidHJhY3Qgc21hbGxlciBtYXJnaW4sIGJ1dCBvbmx5IHdoZW4gdG9wIG1hcmdpbiBpcyBub3QgMCwgYW5kIHRoaXMgaXMgbm90IHRoZSBmaXJzdCBlbGVtZW50XG5cdFx0XHRcdFx0XHRpZiAoaXRlbU1hcmdpbkVuZCAmJiBpdGVtTWFyZ2luU3RhcnQgJiYgaSA+IDApIHtcblx0XHRcdFx0XHRcdFx0c2xpZGVlU2l6ZSAtPSBtaW4oaXRlbU1hcmdpblN0YXJ0LCBpdGVtTWFyZ2luRW5kKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBUaGluZ3MgdG8gYmUgZG9uZSBvbiBsYXN0IGl0ZW1cblx0XHRcdFx0XHRpZiAoaSA9PT0gbGFzdEl0ZW1JbmRleCkge1xuXHRcdFx0XHRcdFx0aXRlbS5lbmQgKz0gcGFkZGluZ0VuZDtcblx0XHRcdFx0XHRcdHNsaWRlZVNpemUgKz0gcGFkZGluZ0VuZDtcblx0XHRcdFx0XHRcdGlnbm9yZWRNYXJnaW4gPSBzaW5nbGVTcGFjZWQgPyBpdGVtTWFyZ2luRW5kIDogMDtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBBZGQgaXRlbSBvYmplY3QgdG8gaXRlbXMgYXJyYXlcblx0XHRcdFx0XHRpdGVtcy5wdXNoKGl0ZW0pO1xuXHRcdFx0XHRcdGxhc3RJdGVtID0gaXRlbTtcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0Ly8gUmVzaXplIFNMSURFRSB0byBmaXQgYWxsIGl0ZW1zXG5cdFx0XHRcdCRzbGlkZWVbMF0uc3R5bGVbby5ob3Jpem9udGFsID8gJ3dpZHRoJyA6ICdoZWlnaHQnXSA9IChib3JkZXJCb3ggPyBzbGlkZWVTaXplOiBzbGlkZWVTaXplIC0gcGFkZGluZ1N0YXJ0IC0gcGFkZGluZ0VuZCkgKyAncHgnO1xuXG5cdFx0XHRcdC8vIEFkanVzdCBpbnRlcm5hbCBTTElERUUgc2l6ZSBmb3IgbGFzdCBtYXJnaW5cblx0XHRcdFx0c2xpZGVlU2l6ZSAtPSBpZ25vcmVkTWFyZ2luO1xuXG5cdFx0XHRcdC8vIFNldCBsaW1pdHNcblx0XHRcdFx0aWYgKGl0ZW1zLmxlbmd0aCkge1xuXHRcdFx0XHRcdHBvcy5zdGFydCA9ICBpdGVtc1swXVtmb3JjZUNlbnRlcmVkTmF2ID8gJ2NlbnRlcicgOiAnc3RhcnQnXTtcblx0XHRcdFx0XHRwb3MuZW5kID0gZm9yY2VDZW50ZXJlZE5hdiA/IGxhc3RJdGVtLmNlbnRlciA6IGZyYW1lU2l6ZSA8IHNsaWRlZVNpemUgPyBsYXN0SXRlbS5lbmQgOiBwb3Muc3RhcnQ7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cG9zLnN0YXJ0ID0gcG9zLmVuZCA9IDA7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gQ2FsY3VsYXRlIFNMSURFRSBjZW50ZXIgcG9zaXRpb25cblx0XHRcdHBvcy5jZW50ZXIgPSByb3VuZChwb3MuZW5kIC8gMiArIHBvcy5zdGFydCAvIDIpO1xuXG5cdFx0XHQvLyBVcGRhdGUgcmVsYXRpdmUgcG9zaXRpb25zXG5cdFx0XHR1cGRhdGVSZWxhdGl2ZXMoKTtcblxuXHRcdFx0Ly8gU2Nyb2xsYmFyXG5cdFx0XHRpZiAoJGhhbmRsZS5sZW5ndGggJiYgc2JTaXplID4gMCkge1xuXHRcdFx0XHQvLyBTdHJldGNoIHNjcm9sbGJhciBoYW5kbGUgdG8gcmVwcmVzZW50IHRoZSB2aXNpYmxlIGFyZWFcblx0XHRcdFx0aWYgKG8uZHluYW1pY0hhbmRsZSkge1xuXHRcdFx0XHRcdGhhbmRsZVNpemUgPSBwb3Muc3RhcnQgPT09IHBvcy5lbmQgPyBzYlNpemUgOiByb3VuZChzYlNpemUgKiBmcmFtZVNpemUvMiAvIHNsaWRlZVNpemUpO1xuXHRcdFx0XHRcdGhhbmRsZVNpemUgPSB3aXRoaW4oaGFuZGxlU2l6ZSwgby5taW5IYW5kbGVTaXplLCBzYlNpemUpO1xuXHRcdFx0XHRcdCRoYW5kbGVbMF0uc3R5bGVbby5ob3Jpem9udGFsID8gJ3dpZHRoJyA6ICdoZWlnaHQnXSA9IGhhbmRsZVNpemUgLSAxMDAgKyAncHgnO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGhhbmRsZVNpemUgPSAkaGFuZGxlW28uaG9yaXpvbnRhbCA/ICdvdXRlcldpZHRoJyA6ICdvdXRlckhlaWdodCddKCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRoUG9zLmVuZCA9IHNiU2l6ZSAtIGhhbmRsZVNpemU7XG5cblx0XHRcdFx0aWYgKCFyZW5kZXJJRCkge1xuXHRcdFx0XHRcdHN5bmNTY3JvbGxiYXIoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBQYWdlc1xuXHRcdFx0aWYgKCFwYXJhbGxheCAmJiBmcmFtZVNpemUgPiAwKSB7XG5cdFx0XHRcdHZhciB0ZW1wUGFnZVBvcyA9IHBvcy5zdGFydDtcblx0XHRcdFx0dmFyIHBhZ2VzSHRtbCA9ICcnO1xuXG5cdFx0XHRcdC8vIFBvcHVsYXRlIHBhZ2VzIGFycmF5XG5cdFx0XHRcdGlmIChpdGVtTmF2KSB7XG5cdFx0XHRcdFx0JC5lYWNoKGl0ZW1zLCBmdW5jdGlvbiAoaSwgaXRlbSkge1xuXHRcdFx0XHRcdFx0aWYgKGZvcmNlQ2VudGVyZWROYXYpIHtcblx0XHRcdFx0XHRcdFx0cGFnZXMucHVzaChpdGVtLmNlbnRlcik7XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKGl0ZW0uc3RhcnQgKyBpdGVtLnNpemUgPiB0ZW1wUGFnZVBvcyAmJiB0ZW1wUGFnZVBvcyA8PSBwb3MuZW5kKSB7XG5cdFx0XHRcdFx0XHRcdHRlbXBQYWdlUG9zID0gaXRlbS5zdGFydDtcblx0XHRcdFx0XHRcdFx0cGFnZXMucHVzaCh0ZW1wUGFnZVBvcyk7XG5cdFx0XHRcdFx0XHRcdHRlbXBQYWdlUG9zICs9IGZyYW1lU2l6ZTtcblx0XHRcdFx0XHRcdFx0aWYgKHRlbXBQYWdlUG9zID4gcG9zLmVuZCAmJiB0ZW1wUGFnZVBvcyA8IHBvcy5lbmQgKyBmcmFtZVNpemUpIHtcblx0XHRcdFx0XHRcdFx0XHRwYWdlcy5wdXNoKHBvcy5lbmQpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0d2hpbGUgKHRlbXBQYWdlUG9zIC0gZnJhbWVTaXplIDwgcG9zLmVuZCkge1xuXHRcdFx0XHRcdFx0cGFnZXMucHVzaCh0ZW1wUGFnZVBvcyk7XG5cdFx0XHRcdFx0XHR0ZW1wUGFnZVBvcyArPSBmcmFtZVNpemU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gUGFnZXMgYmFyXG5cdFx0XHRcdGlmICgkcGJbMF0gJiYgbGFzdFBhZ2VzQ291bnQgIT09IHBhZ2VzLmxlbmd0aCkge1xuXHRcdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgcGFnZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRcdHBhZ2VzSHRtbCArPSBvLnBhZ2VCdWlsZGVyLmNhbGwoc2VsZiwgaSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdCRwYWdlcyA9ICRwYi5odG1sKHBhZ2VzSHRtbCkuY2hpbGRyZW4oKTtcblx0XHRcdFx0XHQkcGFnZXMuZXEocmVsLmFjdGl2ZVBhZ2UpLmFkZENsYXNzKG8uYWN0aXZlQ2xhc3MpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIEV4dGVuZCByZWxhdGl2ZSB2YXJpYWJsZXMgb2JqZWN0IHdpdGggc29tZSB1c2VmdWwgaW5mb1xuXHRcdFx0cmVsLnNsaWRlZVNpemUgPSBzbGlkZWVTaXplO1xuXHRcdFx0cmVsLmZyYW1lU2l6ZSA9IGZyYW1lU2l6ZTtcblx0XHRcdHJlbC5zYlNpemUgPSBzYlNpemU7XG5cdFx0XHRyZWwuaGFuZGxlU2l6ZSA9IGhhbmRsZVNpemU7XG5cblx0XHRcdC8vIEFjdGl2YXRlIHJlcXVlc3RlZCBwb3NpdGlvblxuXHRcdFx0aWYgKGl0ZW1OYXYpIHtcblx0XHRcdFx0aWYgKGlzSW5pdCAmJiBvLnN0YXJ0QXQgIT0gbnVsbCkge1xuXHRcdFx0XHRcdGFjdGl2YXRlKG8uc3RhcnRBdCk7XG5cdFx0XHRcdFx0c2VsZltjZW50ZXJlZE5hdiA/ICd0b0NlbnRlcicgOiAndG9TdGFydCddKG8uc3RhcnRBdCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gRml4IHBvc3NpYmxlIG92ZXJmbG93aW5nXG5cdFx0XHRcdHZhciBhY3RpdmVJdGVtID0gaXRlbXNbcmVsLmFjdGl2ZUl0ZW1dO1xuXHRcdFx0XHRzbGlkZVRvKGNlbnRlcmVkTmF2ICYmIGFjdGl2ZUl0ZW0gPyBhY3RpdmVJdGVtLmNlbnRlciA6IHdpdGhpbihwb3MuZGVzdCwgcG9zLnN0YXJ0LCBwb3MuZW5kKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAoaXNJbml0KSB7XG5cdFx0XHRcdFx0aWYgKG8uc3RhcnRBdCAhPSBudWxsKSBzbGlkZVRvKG8uc3RhcnRBdCwgMSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gRml4IHBvc3NpYmxlIG92ZXJmbG93aW5nXG5cdFx0XHRcdFx0c2xpZGVUbyh3aXRoaW4ocG9zLmRlc3QsIHBvcy5zdGFydCwgcG9zLmVuZCkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIFRyaWdnZXIgbG9hZCBldmVudFxuXHRcdFx0dHJpZ2dlcignbG9hZCcpO1xuXHRcdH1cblx0XHRzZWxmLnJlbG9hZCA9IGZ1bmN0aW9uICgpIHsgbG9hZCgpOyB9O1xuXG5cdFx0LyoqXG5cdFx0ICogQW5pbWF0ZSB0byBhIHBvc2l0aW9uLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtJbnR9ICBuZXdQb3MgICAgTmV3IHBvc2l0aW9uLlxuXHRcdCAqIEBwYXJhbSB7Qm9vbH0gaW1tZWRpYXRlIFJlcG9zaXRpb24gaW1tZWRpYXRlbHkgd2l0aG91dCBhbiBhbmltYXRpb24uXG5cdFx0ICogQHBhcmFtIHtCb29sfSBkb250QWxpZ24gRG8gbm90IGFsaWduIGl0ZW1zLCB1c2UgdGhlIHJhdyBwb3NpdGlvbiBwYXNzZWQgaW4gZmlyc3QgYXJndW1lbnQuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtWb2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHNsaWRlVG8obmV3UG9zLCBpbW1lZGlhdGUsIGRvbnRBbGlnbikge1xuXHRcdFx0Ly8gQWxpZ24gaXRlbXNcblx0XHRcdGlmIChpdGVtTmF2ICYmIGRyYWdnaW5nLnJlbGVhc2VkICYmICFkb250QWxpZ24pIHtcblx0XHRcdFx0dmFyIHRlbXBSZWwgPSBnZXRSZWxhdGl2ZXMobmV3UG9zKTtcblx0XHRcdFx0dmFyIGlzTm90Qm9yZGVyaW5nID0gbmV3UG9zID4gcG9zLnN0YXJ0ICYmIG5ld1BvcyA8IHBvcy5lbmQ7XG5cblx0XHRcdFx0aWYgKGNlbnRlcmVkTmF2KSB7XG5cdFx0XHRcdFx0aWYgKGlzTm90Qm9yZGVyaW5nKSB7XG5cdFx0XHRcdFx0XHRuZXdQb3MgPSBpdGVtc1t0ZW1wUmVsLmNlbnRlckl0ZW1dLmNlbnRlcjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGZvcmNlQ2VudGVyZWROYXYgJiYgby5hY3RpdmF0ZU1pZGRsZSkge1xuXHRcdFx0XHRcdFx0YWN0aXZhdGUodGVtcFJlbC5jZW50ZXJJdGVtKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSBpZiAoaXNOb3RCb3JkZXJpbmcpIHtcblx0XHRcdFx0XHRuZXdQb3MgPSBpdGVtc1t0ZW1wUmVsLmZpcnN0SXRlbV0uc3RhcnQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gSGFuZGxlIG92ZXJmbG93aW5nIHBvc2l0aW9uIGxpbWl0c1xuXHRcdFx0aWYgKGRyYWdnaW5nLmluaXQgJiYgZHJhZ2dpbmcuc2xpZGVlICYmIG8uZWxhc3RpY0JvdW5kcykge1xuXHRcdFx0XHRpZiAobmV3UG9zID4gcG9zLmVuZCkge1xuXHRcdFx0XHRcdG5ld1BvcyA9IHBvcy5lbmQgKyAobmV3UG9zIC0gcG9zLmVuZCkgLyA2O1xuXHRcdFx0XHR9IGVsc2UgaWYgKG5ld1BvcyA8IHBvcy5zdGFydCkge1xuXHRcdFx0XHRcdG5ld1BvcyA9IHBvcy5zdGFydCArIChuZXdQb3MgLSBwb3Muc3RhcnQpIC8gNjtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bmV3UG9zID0gd2l0aGluKG5ld1BvcywgcG9zLnN0YXJ0LCBwb3MuZW5kKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gVXBkYXRlIHRoZSBhbmltYXRpb24gb2JqZWN0XG5cdFx0XHRhbmltYXRpb24uc3RhcnQgPSArbmV3IERhdGUoKTtcblx0XHRcdGFuaW1hdGlvbi50aW1lID0gMDtcblx0XHRcdGFuaW1hdGlvbi5mcm9tID0gcG9zLmN1cjtcblx0XHRcdGFuaW1hdGlvbi50byA9IG5ld1Bvcztcblx0XHRcdGFuaW1hdGlvbi5kZWx0YSA9IG5ld1BvcyAtIHBvcy5jdXI7XG5cdFx0XHRhbmltYXRpb24udHdlZXNpbmcgPSBkcmFnZ2luZy50d2Vlc2UgfHwgZHJhZ2dpbmcuaW5pdCAmJiAhZHJhZ2dpbmcuc2xpZGVlO1xuXHRcdFx0YW5pbWF0aW9uLmltbWVkaWF0ZSA9ICFhbmltYXRpb24udHdlZXNpbmcgJiYgKGltbWVkaWF0ZSB8fCBkcmFnZ2luZy5pbml0ICYmIGRyYWdnaW5nLnNsaWRlZSB8fCAhby5zcGVlZCk7XG5cblx0XHRcdC8vIFJlc2V0IGRyYWdnaW5nIHR3ZWVzaW5nIHJlcXVlc3Rcblx0XHRcdGRyYWdnaW5nLnR3ZWVzZSA9IDA7XG5cblx0XHRcdC8vIFN0YXJ0IGFuaW1hdGlvbiByZW5kZXJpbmdcblx0XHRcdGlmIChuZXdQb3MgIT09IHBvcy5kZXN0KSB7XG5cdFx0XHRcdHBvcy5kZXN0ID0gbmV3UG9zO1xuXHRcdFx0XHR0cmlnZ2VyKCdjaGFuZ2UnKTtcblx0XHRcdFx0aWYgKCFyZW5kZXJJRCkge1xuXHRcdFx0XHRcdHJlbmRlcigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIFJlc2V0IG5leHQgY3ljbGUgdGltZW91dFxuXHRcdFx0cmVzZXRDeWNsZSgpO1xuXG5cdFx0XHQvLyBTeW5jaHJvbml6ZSBzdGF0ZXNcblx0XHRcdHVwZGF0ZVJlbGF0aXZlcygpO1xuXHRcdFx0dXBkYXRlQnV0dG9uc1N0YXRlKCk7XG5cdFx0XHRzeW5jUGFnZXNiYXIoKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW5kZXIgYW5pbWF0aW9uIGZyYW1lLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Vm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZW5kZXIoKSB7XG5cdFx0XHRpZiAoIXNlbGYuaW5pdGlhbGl6ZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBJZiBmaXJzdCByZW5kZXIgY2FsbCwgd2FpdCBmb3IgbmV4dCBhbmltYXRpb25GcmFtZVxuXHRcdFx0aWYgKCFyZW5kZXJJRCkge1xuXHRcdFx0XHRyZW5kZXJJRCA9IHJBRihyZW5kZXIpO1xuXHRcdFx0XHRpZiAoZHJhZ2dpbmcucmVsZWFzZWQpIHtcblx0XHRcdFx0XHR0cmlnZ2VyKCdtb3ZlU3RhcnQnKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIElmIGltbWVkaWF0ZSByZXBvc2l0aW9uaW5nIGlzIHJlcXVlc3RlZCwgZG9uJ3QgYW5pbWF0ZS5cblx0XHRcdGlmIChhbmltYXRpb24uaW1tZWRpYXRlKSB7XG5cdFx0XHRcdHBvcy5jdXIgPSBhbmltYXRpb24udG87XG5cdFx0XHR9XG5cdFx0XHQvLyBVc2UgdHdlZXNpbmcgZm9yIGFuaW1hdGlvbnMgd2l0aG91dCBrbm93biBlbmQgcG9pbnRcblx0XHRcdGVsc2UgaWYgKGFuaW1hdGlvbi50d2Vlc2luZykge1xuXHRcdFx0XHRhbmltYXRpb24udHdlZXNlRGVsdGEgPSBhbmltYXRpb24udG8gLSBwb3MuY3VyO1xuXHRcdFx0XHQvLyBGdWNrIFplbm8ncyBwYXJhZG94XG5cdFx0XHRcdGlmIChhYnMoYW5pbWF0aW9uLnR3ZWVzZURlbHRhKSA8IDAuMSkge1xuXHRcdFx0XHRcdHBvcy5jdXIgPSBhbmltYXRpb24udG87XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cG9zLmN1ciArPSBhbmltYXRpb24udHdlZXNlRGVsdGEgKiAoZHJhZ2dpbmcucmVsZWFzZWQgPyBvLnN3aW5nU3BlZWQgOiBvLnN5bmNTcGVlZCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdC8vIFVzZSB0d2VlbmluZyBmb3IgYmFzaWMgYW5pbWF0aW9ucyB3aXRoIGtub3duIGVuZCBwb2ludFxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdGFuaW1hdGlvbi50aW1lID0gbWluKCtuZXcgRGF0ZSgpIC0gYW5pbWF0aW9uLnN0YXJ0LCBvLnNwZWVkKTtcblx0XHRcdFx0cG9zLmN1ciA9IGFuaW1hdGlvbi5mcm9tICsgYW5pbWF0aW9uLmRlbHRhICogJC5lYXNpbmdbby5lYXNpbmddKGFuaW1hdGlvbi50aW1lL28uc3BlZWQsIGFuaW1hdGlvbi50aW1lLCAwLCAxLCBvLnNwZWVkKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gSWYgdGhlcmUgaXMgbm90aGluZyBtb3JlIHRvIHJlbmRlciBicmVhayB0aGUgcmVuZGVyaW5nIGxvb3AsIG90aGVyd2lzZSByZXF1ZXN0IG5ldyBhbmltYXRpb24gZnJhbWUuXG5cdFx0XHRpZiAoYW5pbWF0aW9uLnRvID09PSBwb3MuY3VyKSB7XG5cdFx0XHRcdHBvcy5jdXIgPSBhbmltYXRpb24udG87XG5cdFx0XHRcdGRyYWdnaW5nLnR3ZWVzZSA9IHJlbmRlcklEID0gMDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlbmRlcklEID0gckFGKHJlbmRlcik7XG5cdFx0XHR9XG5cblx0XHRcdHRyaWdnZXIoJ21vdmUnKTtcblxuXHRcdFx0Ly8gVXBkYXRlIFNMSURFRSBwb3NpdGlvblxuXHRcdFx0aWYgKCFwYXJhbGxheCkge1xuXHRcdFx0XHRpZiAodHJhbnNmb3JtKSB7XG5cdFx0XHRcdFx0JHNsaWRlZVswXS5zdHlsZVt0cmFuc2Zvcm1dID0gZ3B1QWNjZWxlcmF0aW9uICsgKG8uaG9yaXpvbnRhbCA/ICd0cmFuc2xhdGVYJyA6ICd0cmFuc2xhdGVZJykgKyAnKCcgKyAoLXBvcy5jdXIpICsgJ3B4KSc7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0JHNsaWRlZVswXS5zdHlsZVtvLmhvcml6b250YWwgPyAnbGVmdCcgOiAndG9wJ10gPSAtcm91bmQocG9zLmN1cikgKyAncHgnO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIFdoZW4gYW5pbWF0aW9uIHJlYWNoZWQgdGhlIGVuZCwgYW5kIGRyYWdnaW5nIGlzIG5vdCBhY3RpdmUsIHRyaWdnZXIgbW92ZUVuZFxuXHRcdFx0aWYgKCFyZW5kZXJJRCAmJiBkcmFnZ2luZy5yZWxlYXNlZCkge1xuXHRcdFx0XHR0cmlnZ2VyKCdtb3ZlRW5kJyk7XG5cdFx0XHR9XG5cblx0XHRcdHN5bmNTY3JvbGxiYXIoKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTeW5jaHJvbml6ZXMgc2Nyb2xsYmFyIHdpdGggdGhlIFNMSURFRS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge1ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc3luY1Njcm9sbGJhcigpIHtcblx0XHRcdGlmICgkaGFuZGxlLmxlbmd0aCkge1xuXHRcdFx0XHRoUG9zLmN1ciA9IHBvcy5zdGFydCA9PT0gcG9zLmVuZCA/IDAgOiAoKChkcmFnZ2luZy5pbml0ICYmICFkcmFnZ2luZy5zbGlkZWUpID8gcG9zLmRlc3QgOiBwb3MuY3VyKSAtIHBvcy5zdGFydCkgLyAocG9zLmVuZCAtIHBvcy5zdGFydCkgKiBoUG9zLmVuZDtcblx0XHRcdFx0aFBvcy5jdXIgPSB3aXRoaW4ocm91bmQoaFBvcy5jdXIpLCBoUG9zLnN0YXJ0LCBoUG9zLmVuZCk7XG5cdFx0XHRcdGlmIChsYXN0LmhQb3MgIT09IGhQb3MuY3VyKSB7XG5cdFx0XHRcdFx0bGFzdC5oUG9zID0gaFBvcy5jdXI7XG5cdFx0XHRcdFx0aWYgKHRyYW5zZm9ybSkge1xuXHRcdFx0XHRcdFx0JGhhbmRsZVswXS5zdHlsZVt0cmFuc2Zvcm1dID0gZ3B1QWNjZWxlcmF0aW9uICsgKG8uaG9yaXpvbnRhbCA/ICd0cmFuc2xhdGVYJyA6ICd0cmFuc2xhdGVZJykgKyAnKCcgKyBoUG9zLmN1ciArICdweCknO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHQkaGFuZGxlWzBdLnN0eWxlW28uaG9yaXpvbnRhbCA/ICdsZWZ0JyA6ICd0b3AnXSA9IGhQb3MuY3VyICsgJ3B4Jztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTeW5jaHJvbml6ZXMgcGFnZXNiYXIgd2l0aCBTTElERUUuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtWb2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHN5bmNQYWdlc2JhcigpIHtcblx0XHRcdGlmICgkcGFnZXNbMF0gJiYgbGFzdC5wYWdlICE9PSByZWwuYWN0aXZlUGFnZSkge1xuXHRcdFx0XHRsYXN0LnBhZ2UgPSByZWwuYWN0aXZlUGFnZTtcblx0XHRcdFx0JHBhZ2VzLnJlbW92ZUNsYXNzKG8uYWN0aXZlQ2xhc3MpLmVxKHJlbC5hY3RpdmVQYWdlKS5hZGRDbGFzcyhvLmFjdGl2ZUNsYXNzKTtcblx0XHRcdFx0dHJpZ2dlcignYWN0aXZlUGFnZScsIGxhc3QucGFnZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJucyB0aGUgcG9zaXRpb24gb2JqZWN0LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtNaXhlZH0gaXRlbVxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fVxuXHRcdCAqL1xuXHRcdHNlbGYuZ2V0UG9zID0gZnVuY3Rpb24gKGl0ZW0pIHtcblx0XHRcdGlmIChpdGVtTmF2KSB7XG5cdFx0XHRcdHZhciBpbmRleCA9IGdldEluZGV4KGl0ZW0pO1xuXHRcdFx0XHRyZXR1cm4gaW5kZXggIT09IC0xID8gaXRlbXNbaW5kZXhdIDogZmFsc2U7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR2YXIgJGl0ZW0gPSAkc2xpZGVlLmZpbmQoaXRlbSkuZXEoMCk7XG5cblx0XHRcdFx0aWYgKCRpdGVtWzBdKSB7XG5cdFx0XHRcdFx0dmFyIG9mZnNldCA9IG8uaG9yaXpvbnRhbCA/ICRpdGVtLm9mZnNldCgpLmxlZnQgLSAkc2xpZGVlLm9mZnNldCgpLmxlZnQgOiAkaXRlbS5vZmZzZXQoKS50b3AgLSAkc2xpZGVlLm9mZnNldCgpLnRvcDtcblx0XHRcdFx0XHR2YXIgc2l6ZSA9ICRpdGVtW28uaG9yaXpvbnRhbCA/ICdvdXRlcldpZHRoJyA6ICdvdXRlckhlaWdodCddKCk7XG5cblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0c3RhcnQ6IG9mZnNldCxcblx0XHRcdFx0XHRcdGNlbnRlcjogb2Zmc2V0IC0gZnJhbWVTaXplIC8gMiArIHNpemUgLyAyLFxuXHRcdFx0XHRcdFx0ZW5kOiBvZmZzZXQgLSBmcmFtZVNpemUgKyBzaXplLFxuXHRcdFx0XHRcdFx0c2l6ZTogc2l6ZVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdCAqIENvbnRpbnVvdXMgbW92ZSBpbiBhIHNwZWNpZmllZCBkaXJlY3Rpb24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0gIHtCb29sfSBmb3J3YXJkIFRydWUgZm9yIGZvcndhcmQgbW92ZW1lbnQsIG90aGVyd2lzZSBpdCdsbCBnbyBiYWNrd2FyZHMuXG5cdFx0ICogQHBhcmFtICB7SW50fSAgc3BlZWQgICBNb3ZlbWVudCBzcGVlZCBpbiBwaXhlbHMgcGVyIGZyYW1lLiBPdmVycmlkZXMgb3B0aW9ucy5tb3ZlQnkgdmFsdWUuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtWb2lkfVxuXHRcdCAqL1xuXHRcdHNlbGYubW92ZUJ5ID0gZnVuY3Rpb24gKHNwZWVkKSB7XG5cdFx0XHRtb3ZlLnNwZWVkID0gc3BlZWQ7XG5cdFx0XHQvLyBJZiBhbHJlYWR5IGluaXRpYXRlZCwgb3IgdGhlcmUgaXMgbm93aGVyZSB0byBtb3ZlLCBhYm9ydFxuXHRcdFx0aWYgKGRyYWdnaW5nLmluaXQgfHwgIW1vdmUuc3BlZWQgfHwgcG9zLmN1ciA9PT0gKG1vdmUuc3BlZWQgPiAwID8gcG9zLmVuZCA6IHBvcy5zdGFydCkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Ly8gSW5pdGlhdGUgbW92ZSBvYmplY3Rcblx0XHRcdG1vdmUubGFzdFRpbWUgPSArbmV3IERhdGUoKTtcblx0XHRcdG1vdmUuc3RhcnRQb3MgPSBwb3MuY3VyO1xuXHRcdFx0Ly8gU2V0IGRyYWdnaW5nIGFzIGluaXRpYXRlZFxuXHRcdFx0Y29udGludW91c0luaXQoJ2J1dHRvbicpO1xuXHRcdFx0ZHJhZ2dpbmcuaW5pdCA9IDE7XG5cdFx0XHQvLyBTdGFydCBtb3ZlbWVudFxuXHRcdFx0dHJpZ2dlcignbW92ZVN0YXJ0Jyk7XG5cdFx0XHRjQUYoY29udGludW91c0lEKTtcblx0XHRcdG1vdmVMb29wKCk7XG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdCAqIENvbnRpbnVvdXMgbW92ZW1lbnQgbG9vcC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge1ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbW92ZUxvb3AoKSB7XG5cdFx0XHQvLyBJZiB0aGVyZSBpcyBub3doZXJlIHRvIG1vdmUgYW55bW9yZSwgc3RvcFxuXHRcdFx0aWYgKCFtb3ZlLnNwZWVkIHx8IHBvcy5jdXIgPT09IChtb3ZlLnNwZWVkID4gMCA/IHBvcy5lbmQgOiBwb3Muc3RhcnQpKSB7XG5cdFx0XHRcdHNlbGYuc3RvcCgpO1xuXHRcdFx0fVxuXHRcdFx0Ly8gUmVxdWVzdCBuZXcgbW92ZSBsb29wIGlmIGl0IGhhc24ndCBiZWVuIHN0b3BwZWRcblx0XHRcdGNvbnRpbnVvdXNJRCA9IGRyYWdnaW5nLmluaXQgPyByQUYobW92ZUxvb3ApIDogMDtcblx0XHRcdC8vIFVwZGF0ZSBtb3ZlIG9iamVjdFxuXHRcdFx0bW92ZS5ub3cgPSArbmV3IERhdGUoKTtcblx0XHRcdG1vdmUucG9zID0gcG9zLmN1ciArIChtb3ZlLm5vdyAtIG1vdmUubGFzdFRpbWUpIC8gMTAwMCAqIG1vdmUuc3BlZWQ7XG5cdFx0XHQvLyBTbGlkZVxuXHRcdFx0c2xpZGVUbyhkcmFnZ2luZy5pbml0ID8gbW92ZS5wb3MgOiByb3VuZChtb3ZlLnBvcykpO1xuXHRcdFx0Ly8gTm9ybWFsbHksIHRoaXMgaXMgdHJpZ2dlcmVkIGluIHJlbmRlcigpLCBidXQgaWYgdGhlcmVcblx0XHRcdC8vIGlzIG5vdGhpbmcgdG8gcmVuZGVyLCB3ZSBoYXZlIHRvIGRvIGl0IG1hbnVhbGx5IGhlcmUuXG5cdFx0XHRpZiAoIWRyYWdnaW5nLmluaXQgJiYgcG9zLmN1ciA9PT0gcG9zLmRlc3QpIHtcblx0XHRcdFx0dHJpZ2dlcignbW92ZUVuZCcpO1xuXHRcdFx0fVxuXHRcdFx0Ly8gVXBkYXRlIHRpbWVzIGZvciBmdXR1cmUgaXRlcmF0aW9uXG5cdFx0XHRtb3ZlLmxhc3RUaW1lID0gbW92ZS5ub3c7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3RvcHMgY29udGludW91cyBtb3ZlbWVudC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge1ZvaWR9XG5cdFx0ICovXG5cdFx0c2VsZi5zdG9wID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0aWYgKGRyYWdnaW5nLnNvdXJjZSA9PT0gJ2J1dHRvbicpIHtcblx0XHRcdFx0ZHJhZ2dpbmcuaW5pdCA9IDA7XG5cdFx0XHRcdGRyYWdnaW5nLnJlbGVhc2VkID0gMTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0LyoqXG5cdFx0ICogQWN0aXZhdGUgcHJldmlvdXMgaXRlbS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge1ZvaWR9XG5cdFx0ICovXG5cdFx0c2VsZi5wcmV2ID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0c2VsZi5hY3RpdmF0ZShyZWwuYWN0aXZlSXRlbSA9PSBudWxsID8gMCA6IHJlbC5hY3RpdmVJdGVtIC0gMSk7XG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdCAqIEFjdGl2YXRlIG5leHQgaXRlbS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge1ZvaWR9XG5cdFx0ICovXG5cdFx0c2VsZi5uZXh0ID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0c2VsZi5hY3RpdmF0ZShyZWwuYWN0aXZlSXRlbSA9PSBudWxsID8gMCA6IHJlbC5hY3RpdmVJdGVtICsgMSk7XG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdCAqIEFjdGl2YXRlIHByZXZpb3VzIHBhZ2UuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtWb2lkfVxuXHRcdCAqL1xuXHRcdHNlbGYucHJldlBhZ2UgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRzZWxmLmFjdGl2YXRlUGFnZShyZWwuYWN0aXZlUGFnZSAtIDEpO1xuXHRcdH07XG5cblx0XHQvKipcblx0XHQgKiBBY3RpdmF0ZSBuZXh0IHBhZ2UuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtWb2lkfVxuXHRcdCAqL1xuXHRcdHNlbGYubmV4dFBhZ2UgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRzZWxmLmFjdGl2YXRlUGFnZShyZWwuYWN0aXZlUGFnZSArIDEpO1xuXHRcdH07XG5cblx0XHQvKipcblx0XHQgKiBTbGlkZSBTTElERUUgYnkgYW1vdW50IG9mIHBpeGVscy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SW50fSAgZGVsdGEgICAgIFBpeGVscy9JdGVtcy4gUG9zaXRpdmUgbWVhbnMgZm9yd2FyZCwgbmVnYXRpdmUgbWVhbnMgYmFja3dhcmQuXG5cdFx0ICogQHBhcmFtIHtCb29sfSBpbW1lZGlhdGUgUmVwb3NpdGlvbiBpbW1lZGlhdGVseSB3aXRob3V0IGFuIGFuaW1hdGlvbi5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge1ZvaWR9XG5cdFx0ICovXG5cdFx0c2VsZi5zbGlkZUJ5ID0gZnVuY3Rpb24gKGRlbHRhLCBpbW1lZGlhdGUpIHtcblx0XHRcdGlmICghZGVsdGEpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGl0ZW1OYXYpIHtcblx0XHRcdFx0c2VsZltjZW50ZXJlZE5hdiA/ICd0b0NlbnRlcicgOiAndG9TdGFydCddKFxuXHRcdFx0XHRcdHdpdGhpbigoY2VudGVyZWROYXYgPyByZWwuY2VudGVySXRlbSA6IHJlbC5maXJzdEl0ZW0pICsgby5zY3JvbGxCeSAqIGRlbHRhLCAwLCBpdGVtcy5sZW5ndGgpXG5cdFx0XHRcdCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzbGlkZVRvKHBvcy5kZXN0ICsgZGVsdGEsIGltbWVkaWF0ZSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdCAqIEFuaW1hdGUgU0xJREVFIHRvIGEgc3BlY2lmaWMgcG9zaXRpb24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0ludH0gIHBvcyAgICAgICBOZXcgcG9zaXRpb24uXG5cdFx0ICogQHBhcmFtIHtCb29sfSBpbW1lZGlhdGUgUmVwb3NpdGlvbiBpbW1lZGlhdGVseSB3aXRob3V0IGFuIGFuaW1hdGlvbi5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge1ZvaWR9XG5cdFx0ICovXG5cdFx0c2VsZi5zbGlkZVRvID0gZnVuY3Rpb24gKHBvcywgaW1tZWRpYXRlKSB7XG5cdFx0XHRzbGlkZVRvKHBvcywgaW1tZWRpYXRlKTtcblx0XHR9O1xuXG5cdFx0LyoqXG5cdFx0ICogQ29yZSBtZXRob2QgZm9yIGhhbmRsaW5nIGB0b0xvY2F0aW9uYCBtZXRob2RzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtICB7U3RyaW5nfSBsb2NhdGlvblxuXHRcdCAqIEBwYXJhbSAge01peGVkfSAgaXRlbVxuXHRcdCAqIEBwYXJhbSAge0Jvb2x9ICAgaW1tZWRpYXRlXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtWb2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHRvKGxvY2F0aW9uLCBpdGVtLCBpbW1lZGlhdGUpIHtcblx0XHRcdC8vIE9wdGlvbmFsIGFyZ3VtZW50cyBsb2dpY1xuXHRcdFx0aWYgKHR5cGUoaXRlbSkgPT09ICdib29sZWFuJykge1xuXHRcdFx0XHRpbW1lZGlhdGUgPSBpdGVtO1xuXHRcdFx0XHRpdGVtID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaXRlbSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHNsaWRlVG8ocG9zW2xvY2F0aW9uXSwgaW1tZWRpYXRlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIFlvdSBjYW4ndCBhbGlnbiBpdGVtcyB0byBzaWRlcyBvZiB0aGUgZnJhbWVcblx0XHRcdFx0Ly8gd2hlbiBjZW50ZXJlZCBuYXZpZ2F0aW9uIHR5cGUgaXMgZW5hYmxlZFxuXHRcdFx0XHRpZiAoY2VudGVyZWROYXYgJiYgbG9jYXRpb24gIT09ICdjZW50ZXInKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dmFyIGl0ZW1Qb3MgPSBzZWxmLmdldFBvcyhpdGVtKTtcblx0XHRcdFx0aWYgKGl0ZW1Qb3MpIHtcblx0XHRcdFx0XHRzbGlkZVRvKGl0ZW1Qb3NbbG9jYXRpb25dLCBpbW1lZGlhdGUsICFjZW50ZXJlZE5hdik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBbmltYXRlIGVsZW1lbnQgb3IgdGhlIHdob2xlIFNMSURFRSB0byB0aGUgc3RhcnQgb2YgdGhlIGZyYW1lLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtNaXhlZH0gaXRlbSAgICAgIEl0ZW0gRE9NIGVsZW1lbnQsIG9yIGluZGV4IHN0YXJ0aW5nIGF0IDAuIE9taXR0aW5nIHdpbGwgYW5pbWF0ZSBTTElERUUuXG5cdFx0ICogQHBhcmFtIHtCb29sfSAgaW1tZWRpYXRlIFJlcG9zaXRpb24gaW1tZWRpYXRlbHkgd2l0aG91dCBhbiBhbmltYXRpb24uXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtWb2lkfVxuXHRcdCAqL1xuXHRcdHNlbGYudG9TdGFydCA9IGZ1bmN0aW9uIChpdGVtLCBpbW1lZGlhdGUpIHtcblx0XHRcdHRvKCdzdGFydCcsIGl0ZW0sIGltbWVkaWF0ZSk7XG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdCAqIEFuaW1hdGUgZWxlbWVudCBvciB0aGUgd2hvbGUgU0xJREVFIHRvIHRoZSBlbmQgb2YgdGhlIGZyYW1lLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtNaXhlZH0gaXRlbSAgICAgIEl0ZW0gRE9NIGVsZW1lbnQsIG9yIGluZGV4IHN0YXJ0aW5nIGF0IDAuIE9taXR0aW5nIHdpbGwgYW5pbWF0ZSBTTElERUUuXG5cdFx0ICogQHBhcmFtIHtCb29sfSAgaW1tZWRpYXRlIFJlcG9zaXRpb24gaW1tZWRpYXRlbHkgd2l0aG91dCBhbiBhbmltYXRpb24uXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtWb2lkfVxuXHRcdCAqL1xuXHRcdHNlbGYudG9FbmQgPSBmdW5jdGlvbiAoaXRlbSwgaW1tZWRpYXRlKSB7XG5cdFx0XHR0bygnZW5kJywgaXRlbSwgaW1tZWRpYXRlKTtcblx0XHR9O1xuXG5cdFx0LyoqXG5cdFx0ICogQW5pbWF0ZSBlbGVtZW50IG9yIHRoZSB3aG9sZSBTTElERUUgdG8gdGhlIGNlbnRlciBvZiB0aGUgZnJhbWUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge01peGVkfSBpdGVtICAgICAgSXRlbSBET00gZWxlbWVudCwgb3IgaW5kZXggc3RhcnRpbmcgYXQgMC4gT21pdHRpbmcgd2lsbCBhbmltYXRlIFNMSURFRS5cblx0XHQgKiBAcGFyYW0ge0Jvb2x9ICBpbW1lZGlhdGUgUmVwb3NpdGlvbiBpbW1lZGlhdGVseSB3aXRob3V0IGFuIGFuaW1hdGlvbi5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge1ZvaWR9XG5cdFx0ICovXG5cdFx0c2VsZi50b0NlbnRlciA9IGZ1bmN0aW9uIChpdGVtLCBpbW1lZGlhdGUpIHtcblx0XHRcdHRvKCdjZW50ZXInLCBpdGVtLCBpbW1lZGlhdGUpO1xuXHRcdH07XG5cblx0XHQvKipcblx0XHQgKiBHZXQgdGhlIGluZGV4IG9mIGFuIGl0ZW0gaW4gU0xJREVFLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtNaXhlZH0gaXRlbSAgICAgSXRlbSBET00gZWxlbWVudC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge0ludH0gIEl0ZW0gaW5kZXgsIG9yIC0xIGlmIG5vdCBmb3VuZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRJbmRleChpdGVtKSB7XG5cdFx0XHRyZXR1cm4gaXRlbSAhPSBudWxsID9cblx0XHRcdFx0XHRpc051bWJlcihpdGVtKSA/XG5cdFx0XHRcdFx0XHRpdGVtID49IDAgJiYgaXRlbSA8IGl0ZW1zLmxlbmd0aCA/IGl0ZW0gOiAtMSA6XG5cdFx0XHRcdFx0XHQkaXRlbXMuaW5kZXgoaXRlbSkgOlxuXHRcdFx0XHRcdC0xO1xuXHRcdH1cblx0XHQvLyBFeHBvc2UgZ2V0SW5kZXggd2l0aG91dCBsb3dlcmluZyB0aGUgY29tcHJlc3NpYmlsaXR5IG9mIGl0LFxuXHRcdC8vIGFzIGl0IGlzIHVzZWQgcXVpdGUgb2Z0ZW4gdGhyb3VnaG91dCBTbHkuXG5cdFx0c2VsZi5nZXRJbmRleCA9IGdldEluZGV4O1xuXG5cdFx0LyoqXG5cdFx0ICogR2V0IGluZGV4IG9mIGFuIGl0ZW0gaW4gU0xJREVFIGJhc2VkIG9uIGEgdmFyaWV0eSBvZiBpbnB1dCB0eXBlcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSAge01peGVkfSBpdGVtIERPTSBlbGVtZW50LCBwb3NpdGl2ZSBvciBuZWdhdGl2ZSBpbnRlZ2VyLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7SW50fSAgIEl0ZW0gaW5kZXgsIG9yIC0xIGlmIG5vdCBmb3VuZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRSZWxhdGl2ZUluZGV4KGl0ZW0pIHtcblx0XHRcdHJldHVybiBnZXRJbmRleChpc051bWJlcihpdGVtKSAmJiBpdGVtIDwgMCA/IGl0ZW0gKyBpdGVtcy5sZW5ndGggOiBpdGVtKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBY3RpdmF0ZXMgYW4gaXRlbS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSAge01peGVkfSBpdGVtIEl0ZW0gRE9NIGVsZW1lbnQsIG9yIGluZGV4IHN0YXJ0aW5nIGF0IDAuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtNaXhlZH0gQWN0aXZhdGVkIGl0ZW0gaW5kZXggb3IgZmFsc2Ugb24gZmFpbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBhY3RpdmF0ZShpdGVtLCBmb3JjZSkge1xuXHRcdFx0dmFyIGluZGV4ID0gZ2V0SW5kZXgoaXRlbSk7XG5cblx0XHRcdGlmICghaXRlbU5hdiB8fCBpbmRleCA8IDApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBVcGRhdGUgY2xhc3NlcywgbGFzdCBhY3RpdmUgaW5kZXgsIGFuZCB0cmlnZ2VyIGFjdGl2ZSBldmVudCBvbmx5IHdoZW4gdGhlcmVcblx0XHRcdC8vIGhhcyBiZWVuIGEgY2hhbmdlLiBPdGhlcndpc2UganVzdCByZXR1cm4gdGhlIGN1cnJlbnQgYWN0aXZlIGluZGV4LlxuXHRcdFx0aWYgKGxhc3QuYWN0aXZlICE9PSBpbmRleCB8fCBmb3JjZSkge1xuXHRcdFx0XHQvLyBVcGRhdGUgY2xhc3Nlc1xuXHRcdFx0XHQkaXRlbXMuZXEocmVsLmFjdGl2ZUl0ZW0pLnJlbW92ZUNsYXNzKG8uYWN0aXZlQ2xhc3MpO1xuXHRcdFx0XHQkaXRlbXMuZXEoaW5kZXgpLmFkZENsYXNzKG8uYWN0aXZlQ2xhc3MpO1xuXG5cdFx0XHRcdGxhc3QuYWN0aXZlID0gcmVsLmFjdGl2ZUl0ZW0gPSBpbmRleDtcblxuXHRcdFx0XHR1cGRhdGVCdXR0b25zU3RhdGUoKTtcblx0XHRcdFx0dHJpZ2dlcignYWN0aXZlJywgaW5kZXgpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gaW5kZXg7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQWN0aXZhdGVzIGFuIGl0ZW0gYW5kIGhlbHBzIHdpdGggZnVydGhlciBuYXZpZ2F0aW9uIHdoZW4gby5zbWFydCBpcyBlbmFibGVkLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtNaXhlZH0gaXRlbSAgICAgIEl0ZW0gRE9NIGVsZW1lbnQsIG9yIGluZGV4IHN0YXJ0aW5nIGF0IDAuXG5cdFx0ICogQHBhcmFtIHtCb29sfSAgaW1tZWRpYXRlIFdoZXRoZXIgdG8gcmVwb3NpdGlvbiBpbW1lZGlhdGVseSBpbiBzbWFydCBuYXZpZ2F0aW9uLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Vm9pZH1cblx0XHQgKi9cblx0XHRzZWxmLmFjdGl2YXRlID0gZnVuY3Rpb24gKGl0ZW0sIGltbWVkaWF0ZSkge1xuXHRcdFx0dmFyIGluZGV4ID0gYWN0aXZhdGUoaXRlbSk7XG5cblx0XHRcdC8vIFNtYXJ0IG5hdmlnYXRpb25cblx0XHRcdGlmIChvLnNtYXJ0ICYmIGluZGV4ICE9PSBmYWxzZSkge1xuXHRcdFx0XHQvLyBXaGVuIGNlbnRlcmVkTmF2IGlzIGVuYWJsZWQsIGNlbnRlciB0aGUgZWxlbWVudC5cblx0XHRcdFx0Ly8gT3RoZXJ3aXNlLCBkZXRlcm1pbmUgd2hlcmUgdG8gcG9zaXRpb24gdGhlIGVsZW1lbnQgYmFzZWQgb24gaXRzIGN1cnJlbnQgcG9zaXRpb24uXG5cdFx0XHRcdC8vIElmIHRoZSBlbGVtZW50IGlzIGN1cnJlbnRseSBvbiB0aGUgZmFyIGVuZCBzaWRlIG9mIHRoZSBmcmFtZSwgYXNzdW1lIHRoYXQgdXNlciBpc1xuXHRcdFx0XHQvLyBtb3ZpbmcgZm9yd2FyZCBhbmQgYW5pbWF0ZSBpdCB0byB0aGUgc3RhcnQgb2YgdGhlIHZpc2libGUgZnJhbWUsIGFuZCB2aWNlIHZlcnNhLlxuXHRcdFx0XHRpZiAoY2VudGVyZWROYXYpIHtcblx0XHRcdFx0XHRzZWxmLnRvQ2VudGVyKGluZGV4LCBpbW1lZGlhdGUpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGluZGV4ID49IHJlbC5sYXN0SXRlbSkge1xuXHRcdFx0XHRcdHNlbGYudG9TdGFydChpbmRleCwgaW1tZWRpYXRlKTtcblx0XHRcdFx0fSBlbHNlIGlmIChpbmRleCA8PSByZWwuZmlyc3RJdGVtKSB7XG5cdFx0XHRcdFx0c2VsZi50b0VuZChpbmRleCwgaW1tZWRpYXRlKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXNldEN5Y2xlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0LyoqXG5cdFx0ICogQWN0aXZhdGVzIGEgcGFnZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SW50fSAgaW5kZXggICAgIFBhZ2UgaW5kZXgsIHN0YXJ0aW5nIGZyb20gMC5cblx0XHQgKiBAcGFyYW0ge0Jvb2x9IGltbWVkaWF0ZSBXaGV0aGVyIHRvIHJlcG9zaXRpb24gaW1tZWRpYXRlbHkgd2l0aG91dCBhbmltYXRpb24uXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtWb2lkfVxuXHRcdCAqL1xuXHRcdHNlbGYuYWN0aXZhdGVQYWdlID0gZnVuY3Rpb24gKGluZGV4LCBpbW1lZGlhdGUpIHtcblx0XHRcdGlmIChpc051bWJlcihpbmRleCkpIHtcblx0XHRcdFx0c2xpZGVUbyhwYWdlc1t3aXRoaW4oaW5kZXgsIDAsIHBhZ2VzLmxlbmd0aCAtIDEpXSwgaW1tZWRpYXRlKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHJlbGF0aXZlIHBvc2l0aW9ucyBvZiBpdGVtcyBiYXNlZCBvbiB0aGVpciB2aXNpYmlsaXR5IHdpdGhpbiBGUkFNRS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SW50fSBzbGlkZWVQb3MgUG9zaXRpb24gb2YgU0xJREVFLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Vm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRSZWxhdGl2ZXMoc2xpZGVlUG9zKSB7XG5cdFx0XHRzbGlkZWVQb3MgPSB3aXRoaW4oaXNOdW1iZXIoc2xpZGVlUG9zKSA/IHNsaWRlZVBvcyA6IHBvcy5kZXN0LCBwb3Muc3RhcnQsIHBvcy5lbmQpO1xuXG5cdFx0XHR2YXIgcmVsYXRpdmVzID0ge307XG5cdFx0XHR2YXIgY2VudGVyT2Zmc2V0ID0gZm9yY2VDZW50ZXJlZE5hdiA/IDAgOiBmcmFtZVNpemUgLyAyO1xuXG5cdFx0XHQvLyBEZXRlcm1pbmUgYWN0aXZlIHBhZ2Vcblx0XHRcdGlmICghcGFyYWxsYXgpIHtcblx0XHRcdFx0Zm9yICh2YXIgcCA9IDAsIHBsID0gcGFnZXMubGVuZ3RoOyBwIDwgcGw7IHArKykge1xuXHRcdFx0XHRcdGlmIChzbGlkZWVQb3MgPj0gcG9zLmVuZCB8fCBwID09PSBwYWdlcy5sZW5ndGggLSAxKSB7XG5cdFx0XHRcdFx0XHRyZWxhdGl2ZXMuYWN0aXZlUGFnZSA9IHBhZ2VzLmxlbmd0aCAtIDE7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoc2xpZGVlUG9zIDw9IHBhZ2VzW3BdICsgY2VudGVyT2Zmc2V0KSB7XG5cdFx0XHRcdFx0XHRyZWxhdGl2ZXMuYWN0aXZlUGFnZSA9IHA7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gUmVsYXRpdmUgaXRlbSBpbmRleGVzXG5cdFx0XHRpZiAoaXRlbU5hdikge1xuXHRcdFx0XHR2YXIgZmlyc3QgPSBmYWxzZTtcblx0XHRcdFx0dmFyIGxhc3QgPSBmYWxzZTtcblx0XHRcdFx0dmFyIGNlbnRlciA9IGZhbHNlO1xuXG5cdFx0XHRcdC8vIEZyb20gc3RhcnRcblx0XHRcdFx0Zm9yICh2YXIgaSA9IDAsIGlsID0gaXRlbXMubGVuZ3RoOyBpIDwgaWw7IGkrKykge1xuXHRcdFx0XHRcdC8vIEZpcnN0IGl0ZW1cblx0XHRcdFx0XHRpZiAoZmlyc3QgPT09IGZhbHNlICYmIHNsaWRlZVBvcyA8PSBpdGVtc1tpXS5zdGFydCArIGl0ZW1zW2ldLmhhbGYpIHtcblx0XHRcdFx0XHRcdGZpcnN0ID0gaTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBDZW50ZXIgaXRlbVxuXHRcdFx0XHRcdGlmIChjZW50ZXIgPT09IGZhbHNlICYmIHNsaWRlZVBvcyA8PSBpdGVtc1tpXS5jZW50ZXIgKyBpdGVtc1tpXS5oYWxmKSB7XG5cdFx0XHRcdFx0XHRjZW50ZXIgPSBpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIExhc3QgaXRlbVxuXHRcdFx0XHRcdGlmIChpID09PSBpbCAtIDEgfHwgc2xpZGVlUG9zIDw9IGl0ZW1zW2ldLmVuZCArIGl0ZW1zW2ldLmhhbGYpIHtcblx0XHRcdFx0XHRcdGxhc3QgPSBpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gU2FmZSBhc3NpZ25tZW50LCBqdXN0IHRvIGJlIHN1cmUgdGhlIGZhbHNlIHdvbid0IGJlIHJldHVybmVkXG5cdFx0XHRcdHJlbGF0aXZlcy5maXJzdEl0ZW0gPSBpc051bWJlcihmaXJzdCkgPyBmaXJzdCA6IDA7XG5cdFx0XHRcdHJlbGF0aXZlcy5jZW50ZXJJdGVtID0gaXNOdW1iZXIoY2VudGVyKSA/IGNlbnRlciA6IHJlbGF0aXZlcy5maXJzdEl0ZW07XG5cdFx0XHRcdHJlbGF0aXZlcy5sYXN0SXRlbSA9IGlzTnVtYmVyKGxhc3QpID8gbGFzdCA6IHJlbGF0aXZlcy5jZW50ZXJJdGVtO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcmVsYXRpdmVzO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFVwZGF0ZSBvYmplY3Qgd2l0aCByZWxhdGl2ZSBwb3NpdGlvbnMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0ludH0gbmV3UG9zXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtWb2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHVwZGF0ZVJlbGF0aXZlcyhuZXdQb3MpIHtcblx0XHRcdCQuZXh0ZW5kKHJlbCwgZ2V0UmVsYXRpdmVzKG5ld1BvcykpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIERpc2FibGUgbmF2aWdhdGlvbiBidXR0b25zIHdoZW4gbmVlZGVkLlxuXHRcdCAqXG5cdFx0ICogQWRkcyBkaXNhYmxlZENsYXNzLCBhbmQgd2hlbiB0aGUgYnV0dG9uIGlzIDxidXR0b24+IG9yIDxpbnB1dD4sIGFjdGl2YXRlcyA6ZGlzYWJsZWQgc3RhdGUuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtWb2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHVwZGF0ZUJ1dHRvbnNTdGF0ZSgpIHtcblx0XHRcdHZhciBpc1N0YXJ0ID0gcG9zLmRlc3QgPD0gcG9zLnN0YXJ0O1xuXHRcdFx0dmFyIGlzRW5kID0gcG9zLmRlc3QgPj0gcG9zLmVuZDtcblx0XHRcdHZhciBzbGlkZWVQb3NTdGF0ZSA9IChpc1N0YXJ0ID8gMSA6IDApIHwgKGlzRW5kID8gMiA6IDApO1xuXG5cdFx0XHQvLyBVcGRhdGUgcGFnaW5nIGJ1dHRvbnMgb25seSBpZiB0aGVyZSBoYXMgYmVlbiBhIGNoYW5nZSBpbiBTTElERUUgcG9zaXRpb25cblx0XHRcdGlmIChsYXN0LnNsaWRlZVBvc1N0YXRlICE9PSBzbGlkZWVQb3NTdGF0ZSkge1xuXHRcdFx0XHRsYXN0LnNsaWRlZVBvc1N0YXRlID0gc2xpZGVlUG9zU3RhdGU7XG5cblx0XHRcdFx0aWYgKCRwcmV2UGFnZUJ1dHRvbi5pcygnYnV0dG9uLGlucHV0JykpIHtcblx0XHRcdFx0XHQkcHJldlBhZ2VCdXR0b24ucHJvcCgnZGlzYWJsZWQnLCBpc1N0YXJ0KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICgkbmV4dFBhZ2VCdXR0b24uaXMoJ2J1dHRvbixpbnB1dCcpKSB7XG5cdFx0XHRcdFx0JG5leHRQYWdlQnV0dG9uLnByb3AoJ2Rpc2FibGVkJywgaXNFbmQpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0JHByZXZQYWdlQnV0dG9uLmFkZCgkYmFja3dhcmRCdXR0b24pW2lzU3RhcnQgPyAnYWRkQ2xhc3MnIDogJ3JlbW92ZUNsYXNzJ10oby5kaXNhYmxlZENsYXNzKTtcblx0XHRcdFx0JG5leHRQYWdlQnV0dG9uLmFkZCgkZm9yd2FyZEJ1dHRvbilbaXNFbmQgPyAnYWRkQ2xhc3MnIDogJ3JlbW92ZUNsYXNzJ10oby5kaXNhYmxlZENsYXNzKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gRm9yd2FyZCAmIEJhY2t3YXJkIGJ1dHRvbnMgbmVlZCBhIHNlcGFyYXRlIHN0YXRlIGNhY2hpbmcgYmVjYXVzZSB3ZSBjYW5ub3QgXCJwcm9wZXJ0eSBkaXNhYmxlXCJcblx0XHRcdC8vIHRoZW0gd2hpbGUgdGhleSBhcmUgYmVpbmcgdXNlZCwgYXMgZGlzYWJsZWQgYnV0dG9ucyBzdG9wIGVtaXR0aW5nIG1vdXNlIGV2ZW50cy5cblx0XHRcdGlmIChsYXN0LmZ3ZGJ3ZFN0YXRlICE9PSBzbGlkZWVQb3NTdGF0ZSAmJiBkcmFnZ2luZy5yZWxlYXNlZCkge1xuXHRcdFx0XHRsYXN0LmZ3ZGJ3ZFN0YXRlID0gc2xpZGVlUG9zU3RhdGU7XG5cblx0XHRcdFx0aWYgKCRiYWNrd2FyZEJ1dHRvbi5pcygnYnV0dG9uLGlucHV0JykpIHtcblx0XHRcdFx0XHQkYmFja3dhcmRCdXR0b24ucHJvcCgnZGlzYWJsZWQnLCBpc1N0YXJ0KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICgkZm9yd2FyZEJ1dHRvbi5pcygnYnV0dG9uLGlucHV0JykpIHtcblx0XHRcdFx0XHQkZm9yd2FyZEJ1dHRvbi5wcm9wKCdkaXNhYmxlZCcsIGlzRW5kKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBJdGVtIG5hdmlnYXRpb25cblx0XHRcdGlmIChpdGVtTmF2ICYmIHJlbC5hY3RpdmVJdGVtICE9IG51bGwpIHtcblx0XHRcdFx0dmFyIGlzRmlyc3QgPSByZWwuYWN0aXZlSXRlbSA9PT0gMDtcblx0XHRcdFx0dmFyIGlzTGFzdCA9IHJlbC5hY3RpdmVJdGVtID49IGl0ZW1zLmxlbmd0aCAtIDE7XG5cdFx0XHRcdHZhciBpdGVtc0J1dHRvblN0YXRlID0gKGlzRmlyc3QgPyAxIDogMCkgfCAoaXNMYXN0ID8gMiA6IDApO1xuXG5cdFx0XHRcdGlmIChsYXN0Lml0ZW1zQnV0dG9uU3RhdGUgIT09IGl0ZW1zQnV0dG9uU3RhdGUpIHtcblx0XHRcdFx0XHRsYXN0Lml0ZW1zQnV0dG9uU3RhdGUgPSBpdGVtc0J1dHRvblN0YXRlO1xuXG5cdFx0XHRcdFx0aWYgKCRwcmV2QnV0dG9uLmlzKCdidXR0b24saW5wdXQnKSkge1xuXHRcdFx0XHRcdFx0JHByZXZCdXR0b24ucHJvcCgnZGlzYWJsZWQnLCBpc0ZpcnN0KTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoJG5leHRCdXR0b24uaXMoJ2J1dHRvbixpbnB1dCcpKSB7XG5cdFx0XHRcdFx0XHQkbmV4dEJ1dHRvbi5wcm9wKCdkaXNhYmxlZCcsIGlzTGFzdCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0JHByZXZCdXR0b25baXNGaXJzdCA/ICdhZGRDbGFzcycgOiAncmVtb3ZlQ2xhc3MnXShvLmRpc2FibGVkQ2xhc3MpO1xuXHRcdFx0XHRcdCRuZXh0QnV0dG9uW2lzTGFzdCA/ICdhZGRDbGFzcycgOiAncmVtb3ZlQ2xhc3MnXShvLmRpc2FibGVkQ2xhc3MpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVzdW1lIGN5Y2xpbmcuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0ludH0gcHJpb3JpdHkgUmVzdW1lIHBhdXNlIHdpdGggcHJpb3JpdHkgbG93ZXIgb3IgZXF1YWwgdGhhbiB0aGlzLiBVc2VkIGludGVybmFsbHkgZm9yIHBhdXNlT25Ib3Zlci5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge1ZvaWR9XG5cdFx0ICovXG5cdFx0c2VsZi5yZXN1bWUgPSBmdW5jdGlvbiAocHJpb3JpdHkpIHtcblx0XHRcdGlmICghby5jeWNsZUJ5IHx8ICFvLmN5Y2xlSW50ZXJ2YWwgfHwgby5jeWNsZUJ5ID09PSAnaXRlbXMnICYmICghaXRlbXNbMF0gfHwgcmVsLmFjdGl2ZUl0ZW0gPT0gbnVsbCkgfHwgcHJpb3JpdHkgPCBzZWxmLmlzUGF1c2VkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0c2VsZi5pc1BhdXNlZCA9IDA7XG5cblx0XHRcdGlmIChjeWNsZUlEKSB7XG5cdFx0XHRcdGN5Y2xlSUQgPSBjbGVhclRpbWVvdXQoY3ljbGVJRCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0cmlnZ2VyKCdyZXN1bWUnKTtcblx0XHRcdH1cblxuXHRcdFx0Y3ljbGVJRCA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuXHRcdFx0XHR0cmlnZ2VyKCdjeWNsZScpO1xuXHRcdFx0XHRzd2l0Y2ggKG8uY3ljbGVCeSkge1xuXHRcdFx0XHRcdGNhc2UgJ2l0ZW1zJzpcblx0XHRcdFx0XHRcdHNlbGYuYWN0aXZhdGUocmVsLmFjdGl2ZUl0ZW0gPj0gaXRlbXMubGVuZ3RoIC0gMSA/IDAgOiByZWwuYWN0aXZlSXRlbSArIDEpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0XHRjYXNlICdwYWdlcyc6XG5cdFx0XHRcdFx0XHRzZWxmLmFjdGl2YXRlUGFnZShyZWwuYWN0aXZlUGFnZSA+PSBwYWdlcy5sZW5ndGggLSAxID8gMCA6IHJlbC5hY3RpdmVQYWdlICsgMSk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fSwgby5jeWNsZUludGVydmFsKTtcblx0XHR9O1xuXG5cdFx0LyoqXG5cdFx0ICogUGF1c2UgY3ljbGluZy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SW50fSBwcmlvcml0eSBQYXVzZSBwcmlvcml0eS4gMTAwIGlzIGRlZmF1bHQuIFVzZWQgaW50ZXJuYWxseSBmb3IgcGF1c2VPbkhvdmVyLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Vm9pZH1cblx0XHQgKi9cblx0XHRzZWxmLnBhdXNlID0gZnVuY3Rpb24gKHByaW9yaXR5KSB7XG5cdFx0XHRpZiAocHJpb3JpdHkgPCBzZWxmLmlzUGF1c2VkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0c2VsZi5pc1BhdXNlZCA9IHByaW9yaXR5IHx8IDEwMDtcblxuXHRcdFx0aWYgKGN5Y2xlSUQpIHtcblx0XHRcdFx0Y3ljbGVJRCA9IGNsZWFyVGltZW91dChjeWNsZUlEKTtcblx0XHRcdFx0dHJpZ2dlcigncGF1c2UnKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0LyoqXG5cdFx0ICogVG9nZ2xlIGN5Y2xpbmcuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtWb2lkfVxuXHRcdCAqL1xuXHRcdHNlbGYudG9nZ2xlID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0c2VsZltjeWNsZUlEID8gJ3BhdXNlJyA6ICdyZXN1bWUnXSgpO1xuXHRcdH07XG5cblx0XHQvKipcblx0XHQgKiBVcGRhdGVzIGEgc2lnbmxlIG9yIG11bHRpcGxlIG9wdGlvbiB2YWx1ZXMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge01peGVkfSBuYW1lICBOYW1lIG9mIHRoZSBvcHRpb24gdGhhdCBzaG91bGQgYmUgdXBkYXRlZCwgb3Igb2JqZWN0IHRoYXQgd2lsbCBleHRlbmQgdGhlIG9wdGlvbnMuXG5cdFx0ICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgTmV3IG9wdGlvbiB2YWx1ZS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge1ZvaWR9XG5cdFx0ICovXG5cdFx0c2VsZi5zZXQgPSBmdW5jdGlvbiAobmFtZSwgdmFsdWUpIHtcblx0XHRcdGlmICgkLmlzUGxhaW5PYmplY3QobmFtZSkpIHtcblx0XHRcdFx0JC5leHRlbmQobywgbmFtZSk7XG5cdFx0XHR9IGVsc2UgaWYgKG8uaGFzT3duUHJvcGVydHkobmFtZSkpIHtcblx0XHRcdFx0b1tuYW1lXSA9IHZhbHVlO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHQvKipcblx0XHQgKiBBZGQgb25lIG9yIG11bHRpcGxlIGl0ZW1zIHRvIHRoZSBTTElERUUgZW5kLCBvciBhIHNwZWNpZmllZCBwb3NpdGlvbiBpbmRleC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7TWl4ZWR9IGVsZW1lbnQgTm9kZSBlbGVtZW50LCBvciBIVE1MIHN0cmluZy5cblx0XHQgKiBAcGFyYW0ge0ludH0gICBpbmRleCAgIEluZGV4IG9mIGEgbmV3IGl0ZW0gcG9zaXRpb24uIEJ5IGRlZmF1bHQgaXRlbSBpcyBhcHBlbmRlZCBhdCB0aGUgZW5kLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Vm9pZH1cblx0XHQgKi9cblx0XHRzZWxmLmFkZCA9IGZ1bmN0aW9uIChlbGVtZW50LCBpbmRleCkge1xuXHRcdFx0dmFyICRlbGVtZW50ID0gJChlbGVtZW50KTtcblxuXHRcdFx0aWYgKGl0ZW1OYXYpIHtcblx0XHRcdFx0Ly8gSW5zZXJ0IHRoZSBlbGVtZW50KHMpXG5cdFx0XHRcdGlmIChpbmRleCA9PSBudWxsIHx8ICFpdGVtc1swXSB8fCBpbmRleCA+PSBpdGVtcy5sZW5ndGgpIHtcblx0XHRcdFx0XHQkZWxlbWVudC5hcHBlbmRUbygkc2xpZGVlKTtcblx0XHRcdFx0fSBlbHNlIGlmIChpdGVtcy5sZW5ndGgpIHtcblx0XHRcdFx0XHQkZWxlbWVudC5pbnNlcnRCZWZvcmUoaXRlbXNbaW5kZXhdLmVsKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIEFkanVzdCB0aGUgYWN0aXZlSXRlbSBpbmRleFxuXHRcdFx0XHRpZiAocmVsLmFjdGl2ZUl0ZW0gIT0gbnVsbCAmJiBpbmRleCA8PSByZWwuYWN0aXZlSXRlbSkge1xuXHRcdFx0XHRcdGxhc3QuYWN0aXZlID0gcmVsLmFjdGl2ZUl0ZW0gKz0gJGVsZW1lbnQubGVuZ3RoO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQkc2xpZGVlLmFwcGVuZCgkZWxlbWVudCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFJlbG9hZFxuXHRcdFx0bG9hZCgpO1xuXHRcdH07XG5cblx0XHQvKipcblx0XHQgKiBSZW1vdmUgYW4gaXRlbSBmcm9tIFNMSURFRS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7TWl4ZWR9IGVsZW1lbnQgSXRlbSBpbmRleCwgb3IgRE9NIGVsZW1lbnQuXG5cdFx0ICogQHBhcmFtIHtJbnR9ICAgaW5kZXggICBJbmRleCBvZiBhIG5ldyBpdGVtIHBvc2l0aW9uLiBCeSBkZWZhdWx0IGl0ZW0gaXMgYXBwZW5kZWQgYXQgdGhlIGVuZC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge1ZvaWR9XG5cdFx0ICovXG5cdFx0c2VsZi5yZW1vdmUgPSBmdW5jdGlvbiAoZWxlbWVudCkge1xuXHRcdFx0aWYgKGl0ZW1OYXYpIHtcblx0XHRcdFx0dmFyIGluZGV4ID0gZ2V0UmVsYXRpdmVJbmRleChlbGVtZW50KTtcblxuXHRcdFx0XHRpZiAoaW5kZXggPiAtMSkge1xuXHRcdFx0XHRcdC8vIFJlbW92ZSB0aGUgZWxlbWVudFxuXHRcdFx0XHRcdCRpdGVtcy5lcShpbmRleCkucmVtb3ZlKCk7XG5cblx0XHRcdFx0XHQvLyBJZiB0aGUgY3VycmVudCBpdGVtIGlzIGJlaW5nIHJlbW92ZWQsIGFjdGl2YXRlIG5ldyBvbmUgYWZ0ZXIgcmVsb2FkXG5cdFx0XHRcdFx0dmFyIHJlYWN0aXZhdGUgPSBpbmRleCA9PT0gcmVsLmFjdGl2ZUl0ZW07XG5cblx0XHRcdFx0XHQvLyBBZGp1c3QgdGhlIGFjdGl2ZUl0ZW0gaW5kZXhcblx0XHRcdFx0XHRpZiAocmVsLmFjdGl2ZUl0ZW0gIT0gbnVsbCAmJiBpbmRleCA8IHJlbC5hY3RpdmVJdGVtKSB7XG5cdFx0XHRcdFx0XHRsYXN0LmFjdGl2ZSA9IC0tcmVsLmFjdGl2ZUl0ZW07XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly8gUmVsb2FkXG5cdFx0XHRcdFx0bG9hZCgpO1xuXG5cdFx0XHRcdFx0Ly8gQWN0aXZhdGUgbmV3IGl0ZW0gYXQgdGhlIHJlbW92ZWQgcG9zaXRpb25cblx0XHRcdFx0XHRpZiAocmVhY3RpdmF0ZSkge1xuXHRcdFx0XHRcdFx0bGFzdC5hY3RpdmUgPSBudWxsO1xuXHRcdFx0XHRcdFx0c2VsZi5hY3RpdmF0ZShyZWwuYWN0aXZlSXRlbSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQkKGVsZW1lbnQpLnJlbW92ZSgpO1xuXHRcdFx0XHRsb2FkKCk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdCAqIEhlbHBzIHJlLWFycmFuZ2luZyBpdGVtcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSAge01peGVkfSBpdGVtICAgICBJdGVtIERPTSBlbGVtZW50LCBvciBpbmRleCBzdGFydGluZyBhdCAwLiBVc2UgbmVnYXRpdmUgbnVtYmVycyB0byBzZWxlY3QgaXRlbXMgZnJvbSB0aGUgZW5kLlxuXHRcdCAqIEBwYXJhbSAge01peGVkfSBwb3NpdGlvbiBJdGVtIGluc2VydGlvbiBhbmNob3IuIEFjY2VwdHMgc2FtZSBpbnB1dCB0eXBlcyBhcyBpdGVtIGFyZ3VtZW50LlxuXHRcdCAqIEBwYXJhbSAge0Jvb2x9ICBhZnRlciAgICBJbnNlcnQgYWZ0ZXIgaW5zdGVhZCBvZiBiZWZvcmUgdGhlIGFuY2hvci5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge1ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbW92ZUl0ZW0oaXRlbSwgcG9zaXRpb24sIGFmdGVyKSB7XG5cdFx0XHRpdGVtID0gZ2V0UmVsYXRpdmVJbmRleChpdGVtKTtcblx0XHRcdHBvc2l0aW9uID0gZ2V0UmVsYXRpdmVJbmRleChwb3NpdGlvbik7XG5cblx0XHRcdC8vIE1vdmUgb25seSBpZiB0aGVyZSBpcyBhbiBhY3R1YWwgY2hhbmdlIHJlcXVlc3RlZFxuXHRcdFx0aWYgKGl0ZW0gPiAtMSAmJiBwb3NpdGlvbiA+IC0xICYmIGl0ZW0gIT09IHBvc2l0aW9uICYmICghYWZ0ZXIgfHwgcG9zaXRpb24gIT09IGl0ZW0gLSAxKSAmJiAoYWZ0ZXIgfHwgcG9zaXRpb24gIT09IGl0ZW0gKyAxKSkge1xuXHRcdFx0XHQkaXRlbXMuZXEoaXRlbSlbYWZ0ZXIgPyAnaW5zZXJ0QWZ0ZXInIDogJ2luc2VydEJlZm9yZSddKGl0ZW1zW3Bvc2l0aW9uXS5lbCk7XG5cblx0XHRcdFx0dmFyIHNoaWZ0U3RhcnQgPSBpdGVtIDwgcG9zaXRpb24gPyBpdGVtIDogKGFmdGVyID8gcG9zaXRpb24gOiBwb3NpdGlvbiAtIDEpO1xuXHRcdFx0XHR2YXIgc2hpZnRFbmQgPSBpdGVtID4gcG9zaXRpb24gPyBpdGVtIDogKGFmdGVyID8gcG9zaXRpb24gKyAxIDogcG9zaXRpb24pO1xuXHRcdFx0XHR2YXIgc2hpZnRzVXAgPSBpdGVtID4gcG9zaXRpb247XG5cblx0XHRcdFx0Ly8gVXBkYXRlIGFjdGl2ZUl0ZW0gaW5kZXhcblx0XHRcdFx0aWYgKHJlbC5hY3RpdmVJdGVtICE9IG51bGwpIHtcblx0XHRcdFx0XHRpZiAoaXRlbSA9PT0gcmVsLmFjdGl2ZUl0ZW0pIHtcblx0XHRcdFx0XHRcdGxhc3QuYWN0aXZlID0gcmVsLmFjdGl2ZUl0ZW0gPSBhZnRlciA/IChzaGlmdHNVcCA/IHBvc2l0aW9uICsgMSA6IHBvc2l0aW9uKSA6IChzaGlmdHNVcCA/IHBvc2l0aW9uIDogcG9zaXRpb24gLSAxKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHJlbC5hY3RpdmVJdGVtID4gc2hpZnRTdGFydCAmJiByZWwuYWN0aXZlSXRlbSA8IHNoaWZ0RW5kKSB7XG5cdFx0XHRcdFx0XHRsYXN0LmFjdGl2ZSA9IHJlbC5hY3RpdmVJdGVtICs9IHNoaWZ0c1VwID8gMSA6IC0xO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFJlbG9hZFxuXHRcdFx0XHRsb2FkKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTW92ZSBpdGVtIGFmdGVyIHRoZSB0YXJnZXQgYW5jaG9yLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtICB7TWl4ZWR9IGl0ZW0gICAgIEl0ZW0gdG8gYmUgbW92ZWQuIENhbiBiZSBET00gZWxlbWVudCBvciBpdGVtIGluZGV4LlxuXHRcdCAqIEBwYXJhbSAge01peGVkfSBwb3NpdGlvbiBUYXJnZXQgcG9zaXRpb24gYW5jaG9yLiBDYW4gYmUgRE9NIGVsZW1lbnQgb3IgaXRlbSBpbmRleC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge1ZvaWR9XG5cdFx0ICovXG5cdFx0c2VsZi5tb3ZlQWZ0ZXIgPSBmdW5jdGlvbiAoaXRlbSwgcG9zaXRpb24pIHtcblx0XHRcdG1vdmVJdGVtKGl0ZW0sIHBvc2l0aW9uLCAxKTtcblx0XHR9O1xuXG5cdFx0LyoqXG5cdFx0ICogTW92ZSBpdGVtIGJlZm9yZSB0aGUgdGFyZ2V0IGFuY2hvci5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSAge01peGVkfSBpdGVtICAgICBJdGVtIHRvIGJlIG1vdmVkLiBDYW4gYmUgRE9NIGVsZW1lbnQgb3IgaXRlbSBpbmRleC5cblx0XHQgKiBAcGFyYW0gIHtNaXhlZH0gcG9zaXRpb24gVGFyZ2V0IHBvc2l0aW9uIGFuY2hvci4gQ2FuIGJlIERPTSBlbGVtZW50IG9yIGl0ZW0gaW5kZXguXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtWb2lkfVxuXHRcdCAqL1xuXHRcdHNlbGYubW92ZUJlZm9yZSA9IGZ1bmN0aW9uIChpdGVtLCBwb3NpdGlvbikge1xuXHRcdFx0bW92ZUl0ZW0oaXRlbSwgcG9zaXRpb24pO1xuXHRcdH07XG5cblx0XHQvKipcblx0XHQgKiBSZWdpc3RlcnMgY2FsbGJhY2tzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtICB7TWl4ZWR9IG5hbWUgIEV2ZW50IG5hbWUsIG9yIGNhbGxiYWNrcyBtYXAuXG5cdFx0ICogQHBhcmFtICB7TWl4ZWR9IGZuICAgIENhbGxiYWNrLCBvciBhbiBhcnJheSBvZiBjYWxsYmFjayBmdW5jdGlvbnMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtWb2lkfVxuXHRcdCAqL1xuXHRcdHNlbGYub24gPSBmdW5jdGlvbiAobmFtZSwgZm4pIHtcblx0XHRcdC8vIENhbGxiYWNrcyBtYXBcblx0XHRcdGlmICh0eXBlKG5hbWUpID09PSAnb2JqZWN0Jykge1xuXHRcdFx0XHRmb3IgKHZhciBrZXkgaW4gbmFtZSkge1xuXHRcdFx0XHRcdGlmIChuYW1lLmhhc093blByb3BlcnR5KGtleSkpIHtcblx0XHRcdFx0XHRcdHNlbGYub24oa2V5LCBuYW1lW2tleV0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0Ly8gQ2FsbGJhY2tcblx0XHRcdH0gZWxzZSBpZiAodHlwZShmbikgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0dmFyIG5hbWVzID0gbmFtZS5zcGxpdCgnICcpO1xuXHRcdFx0XHRmb3IgKHZhciBuID0gMCwgbmwgPSBuYW1lcy5sZW5ndGg7IG4gPCBubDsgbisrKSB7XG5cdFx0XHRcdFx0Y2FsbGJhY2tzW25hbWVzW25dXSA9IGNhbGxiYWNrc1tuYW1lc1tuXV0gfHwgW107XG5cdFx0XHRcdFx0aWYgKGNhbGxiYWNrSW5kZXgobmFtZXNbbl0sIGZuKSA9PT0gLTEpIHtcblx0XHRcdFx0XHRcdGNhbGxiYWNrc1tuYW1lc1tuXV0ucHVzaChmbik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHQvLyBDYWxsYmFja3MgYXJyYXlcblx0XHRcdH0gZWxzZSBpZiAodHlwZShmbikgPT09ICdhcnJheScpIHtcblx0XHRcdFx0Zm9yICh2YXIgZiA9IDAsIGZsID0gZm4ubGVuZ3RoOyBmIDwgZmw7IGYrKykge1xuXHRcdFx0XHRcdHNlbGYub24obmFtZSwgZm5bZl0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdCAqIFJlZ2lzdGVycyBjYWxsYmFja3MgdG8gYmUgZXhlY3V0ZWQgb25seSBvbmNlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtICB7TWl4ZWR9IG5hbWUgIEV2ZW50IG5hbWUsIG9yIGNhbGxiYWNrcyBtYXAuXG5cdFx0ICogQHBhcmFtICB7TWl4ZWR9IGZuICAgIENhbGxiYWNrLCBvciBhbiBhcnJheSBvZiBjYWxsYmFjayBmdW5jdGlvbnMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtWb2lkfVxuXHRcdCAqL1xuXHRcdHNlbGYub25lID0gZnVuY3Rpb24gKG5hbWUsIGZuKSB7XG5cdFx0XHRmdW5jdGlvbiBwcm94eSgpIHtcblx0XHRcdFx0Zm4uYXBwbHkoc2VsZiwgYXJndW1lbnRzKTtcblx0XHRcdFx0c2VsZi5vZmYobmFtZSwgcHJveHkpO1xuXHRcdFx0fVxuXHRcdFx0c2VsZi5vbihuYW1lLCBwcm94eSk7XG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdCAqIFJlbW92ZSBvbmUgb3IgYWxsIGNhbGxiYWNrcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSBFdmVudCBuYW1lLlxuXHRcdCAqIEBwYXJhbSAge01peGVkfSAgZm4gICBDYWxsYmFjaywgb3IgYW4gYXJyYXkgb2YgY2FsbGJhY2sgZnVuY3Rpb25zLiBPbWl0IHRvIHJlbW92ZSBhbGwgY2FsbGJhY2tzLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Vm9pZH1cblx0XHQgKi9cblx0XHRzZWxmLm9mZiA9IGZ1bmN0aW9uIChuYW1lLCBmbikge1xuXHRcdFx0aWYgKGZuIGluc3RhbmNlb2YgQXJyYXkpIHtcblx0XHRcdFx0Zm9yICh2YXIgZiA9IDAsIGZsID0gZm4ubGVuZ3RoOyBmIDwgZmw7IGYrKykge1xuXHRcdFx0XHRcdHNlbGYub2ZmKG5hbWUsIGZuW2ZdKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dmFyIG5hbWVzID0gbmFtZS5zcGxpdCgnICcpO1xuXHRcdFx0XHRmb3IgKHZhciBuID0gMCwgbmwgPSBuYW1lcy5sZW5ndGg7IG4gPCBubDsgbisrKSB7XG5cdFx0XHRcdFx0Y2FsbGJhY2tzW25hbWVzW25dXSA9IGNhbGxiYWNrc1tuYW1lc1tuXV0gfHwgW107XG5cdFx0XHRcdFx0aWYgKGZuID09IG51bGwpIHtcblx0XHRcdFx0XHRcdGNhbGxiYWNrc1tuYW1lc1tuXV0ubGVuZ3RoID0gMDtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dmFyIGluZGV4ID0gY2FsbGJhY2tJbmRleChuYW1lc1tuXSwgZm4pO1xuXHRcdFx0XHRcdFx0aWYgKGluZGV4ICE9PSAtMSkge1xuXHRcdFx0XHRcdFx0XHRjYWxsYmFja3NbbmFtZXNbbl1dLnNwbGljZShpbmRleCwgMSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybnMgY2FsbGJhY2sgYXJyYXkgaW5kZXguXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0gIHtTdHJpbmd9ICAgbmFtZSBFdmVudCBuYW1lLlxuXHRcdCAqIEBwYXJhbSAge0Z1bmN0aW9ufSBmbiAgIEZ1bmN0aW9uXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtJbnR9IENhbGxiYWNrIGFycmF5IGluZGV4LCBvciAtMSBpZiBpc24ndCByZWdpc3RlcmVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNhbGxiYWNrSW5kZXgobmFtZSwgZm4pIHtcblx0XHRcdGZvciAodmFyIGkgPSAwLCBsID0gY2FsbGJhY2tzW25hbWVdLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuXHRcdFx0XHRpZiAoY2FsbGJhY2tzW25hbWVdW2ldID09PSBmbikge1xuXHRcdFx0XHRcdHJldHVybiBpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gLTE7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVzZXQgbmV4dCBjeWNsZSB0aW1lb3V0LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Vm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZXNldEN5Y2xlKCkge1xuXHRcdFx0aWYgKGRyYWdnaW5nLnJlbGVhc2VkICYmICFzZWxmLmlzUGF1c2VkKSB7XG5cdFx0XHRcdHNlbGYucmVzdW1lKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ2FsY3VsYXRlIFNMSURFRSByZXByZXNlbnRhdGlvbiBvZiBoYW5kbGUgcG9zaXRpb24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0gIHtJbnR9IGhhbmRsZVBvc1xuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7SW50fVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZVRvU2xpZGVlKGhhbmRsZVBvcykge1xuXHRcdFx0cmV0dXJuIHJvdW5kKHdpdGhpbihoYW5kbGVQb3MsIGhQb3Muc3RhcnQsIGhQb3MuZW5kKSAvIGhQb3MuZW5kICogKHBvcy5lbmQgLSBwb3Muc3RhcnQpKSArIHBvcy5zdGFydDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBLZWVwcyB0cmFjayBvZiBhIGRyYWdnaW5nIGRlbHRhIGhpc3RvcnkuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtWb2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGRyYWdnaW5nSGlzdG9yeVRpY2soKSB7XG5cdFx0XHQvLyBMb29raW5nIGF0IHRoaXMsIEkga25vdyB3aGF0IHlvdSdyZSB0aGlua2luZyA6KSBCdXQgYXMgd2UgbmVlZCBvbmx5IDQgaGlzdG9yeSBzdGF0ZXMsIGRvaW5nIGl0IHRoaXMgd2F5XG5cdFx0XHQvLyBhcyBvcHBvc2VkIHRvIGEgcHJvcGVyIGxvb3AgaXMgfjI1IGJ5dGVzIHNtYWxsZXIgKHdoZW4gbWluaWZpZWQgd2l0aCBHQ0MpLCBhIGxvdCBmYXN0ZXIsIGFuZCBkb2Vzbid0XG5cdFx0XHQvLyBnZW5lcmF0ZSBnYXJiYWdlLiBUaGUgbG9vcCB2ZXJzaW9uIHdvdWxkIGNyZWF0ZSAyIG5ldyB2YXJpYWJsZXMgb24gZXZlcnkgdGljay4gVW5leGFwdGFibGUhXG5cdFx0XHRkcmFnZ2luZy5oaXN0b3J5WzBdID0gZHJhZ2dpbmcuaGlzdG9yeVsxXTtcblx0XHRcdGRyYWdnaW5nLmhpc3RvcnlbMV0gPSBkcmFnZ2luZy5oaXN0b3J5WzJdO1xuXHRcdFx0ZHJhZ2dpbmcuaGlzdG9yeVsyXSA9IGRyYWdnaW5nLmhpc3RvcnlbM107XG5cdFx0XHRkcmFnZ2luZy5oaXN0b3J5WzNdID0gZHJhZ2dpbmcuZGVsdGE7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSW5pdGlhbGl6ZSBjb250aW51b3VzIG1vdmVtZW50LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Vm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjb250aW51b3VzSW5pdChzb3VyY2UpIHtcblx0XHRcdGRyYWdnaW5nLnJlbGVhc2VkID0gMDtcblx0XHRcdGRyYWdnaW5nLnNvdXJjZSA9IHNvdXJjZTtcblx0XHRcdGRyYWdnaW5nLnNsaWRlZSA9IHNvdXJjZSA9PT0gJ3NsaWRlZSc7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRHJhZ2dpbmcgaW5pdGlhdG9yLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtICB7RXZlbnR9IGV2ZW50XG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtWb2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGRyYWdJbml0KGV2ZW50KSB7XG5cdFx0XHR2YXIgaXNUb3VjaCA9IGV2ZW50LnR5cGUgPT09ICd0b3VjaHN0YXJ0Jztcblx0XHRcdHZhciBzb3VyY2UgPSBldmVudC5kYXRhLnNvdXJjZTtcblx0XHRcdHZhciBpc1NsaWRlZSA9IHNvdXJjZSA9PT0gJ3NsaWRlZSc7XG5cblx0XHRcdC8vIElnbm9yZSB3aGVuIGFscmVhZHkgaW4gcHJvZ3Jlc3MsIG9yIGludGVyYWN0aXZlIGVsZW1lbnQgaW4gbm9uLXRvdWNoIG5hdml2YWdpb25cblx0XHRcdGlmIChkcmFnZ2luZy5pbml0IHx8ICFpc1RvdWNoICYmIGlzSW50ZXJhY3RpdmUoZXZlbnQudGFyZ2V0KSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIEhhbmRsZSBkcmFnZ2luZyBjb25kaXRpb25zXG5cdFx0XHRpZiAoc291cmNlID09PSAnaGFuZGxlJyAmJiAoIW8uZHJhZ0hhbmRsZSB8fCBoUG9zLnN0YXJ0ID09PSBoUG9zLmVuZCkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBTTElERUUgZHJhZ2dpbmcgY29uZGl0aW9uc1xuXHRcdFx0aWYgKGlzU2xpZGVlICYmICEoaXNUb3VjaCA/IG8udG91Y2hEcmFnZ2luZyA6IG8ubW91c2VEcmFnZ2luZyAmJiBldmVudC53aGljaCA8IDIpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFpc1RvdWNoKSB7XG5cdFx0XHRcdC8vIHByZXZlbnRzIG5hdGl2ZSBpbWFnZSBkcmFnZ2luZyBpbiBGaXJlZm94XG5cdFx0XHRcdHN0b3BEZWZhdWx0KGV2ZW50KTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gUmVzZXQgZHJhZ2dpbmcgb2JqZWN0XG5cdFx0XHRjb250aW51b3VzSW5pdChzb3VyY2UpO1xuXG5cdFx0XHQvLyBQcm9wZXJ0aWVzIHVzZWQgaW4gZHJhZ0hhbmRsZXJcblx0XHRcdGRyYWdnaW5nLmluaXQgPSAwO1xuXHRcdFx0ZHJhZ2dpbmcuJHNvdXJjZSA9ICQoZXZlbnQudGFyZ2V0KTtcblx0XHRcdGRyYWdnaW5nLnRvdWNoID0gaXNUb3VjaDtcblx0XHRcdGRyYWdnaW5nLnBvaW50ZXIgPSBpc1RvdWNoID8gZXZlbnQub3JpZ2luYWxFdmVudC50b3VjaGVzWzBdIDogZXZlbnQ7XG5cdFx0XHRkcmFnZ2luZy5pbml0WCA9IGRyYWdnaW5nLnBvaW50ZXIucGFnZVg7XG5cdFx0XHRkcmFnZ2luZy5pbml0WSA9IGRyYWdnaW5nLnBvaW50ZXIucGFnZVk7XG5cdFx0XHRkcmFnZ2luZy5pbml0UG9zID0gaXNTbGlkZWUgPyBwb3MuY3VyIDogaFBvcy5jdXI7XG5cdFx0XHRkcmFnZ2luZy5zdGFydCA9ICtuZXcgRGF0ZSgpO1xuXHRcdFx0ZHJhZ2dpbmcudGltZSA9IDA7XG5cdFx0XHRkcmFnZ2luZy5wYXRoID0gMDtcblx0XHRcdGRyYWdnaW5nLmRlbHRhID0gMDtcblx0XHRcdGRyYWdnaW5nLmxvY2tlZCA9IDA7XG5cdFx0XHRkcmFnZ2luZy5oaXN0b3J5ID0gWzAsIDAsIDAsIDBdO1xuXHRcdFx0ZHJhZ2dpbmcucGF0aFRvTG9jayA9IGlzU2xpZGVlID8gaXNUb3VjaCA/IDMwIDogMTAgOiAwO1xuXG5cdFx0XHQvLyBCaW5kIGRyYWdnaW5nIGV2ZW50c1xuXHRcdFx0JGRvYy5vbihpc1RvdWNoID8gZHJhZ1RvdWNoRXZlbnRzIDogZHJhZ01vdXNlRXZlbnRzLCBkcmFnSGFuZGxlcik7XG5cblx0XHRcdC8vIFBhdXNlIG9uZ29pbmcgY3ljbGVcblx0XHRcdHNlbGYucGF1c2UoMSk7XG5cblx0XHRcdC8vIEFkZCBkcmFnZ2luZyBjbGFzc1xuXHRcdFx0KGlzU2xpZGVlID8gJHNsaWRlZSA6ICRoYW5kbGUpLmFkZENsYXNzKG8uZHJhZ2dlZENsYXNzKTtcblxuXHRcdFx0Ly8gVHJpZ2dlciBtb3ZlU3RhcnQgZXZlbnRcblx0XHRcdHRyaWdnZXIoJ21vdmVTdGFydCcpO1xuXG5cdFx0XHQvLyBLZWVwIHRyYWNrIG9mIGEgZHJhZ2dpbmcgcGF0aCBoaXN0b3J5LiBUaGlzIGlzIGxhdGVyIHVzZWQgaW4gdGhlXG5cdFx0XHQvLyBkcmFnZ2luZyByZWxlYXNlIHN3aW5nIGNhbGN1bGF0aW9uIHdoZW4gZHJhZ2dpbmcgU0xJREVFLlxuXHRcdFx0aWYgKGlzU2xpZGVlKSB7XG5cdFx0XHRcdGhpc3RvcnlJRCA9IHNldEludGVydmFsKGRyYWdnaW5nSGlzdG9yeVRpY2ssIDEwKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBIYW5kbGVyIGZvciBkcmFnZ2luZyBzY3JvbGxiYXIgaGFuZGxlIG9yIFNMSURFRS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSAge0V2ZW50fSBldmVudFxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Vm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBkcmFnSGFuZGxlcihldmVudCkge1xuXHRcdFx0ZHJhZ2dpbmcucmVsZWFzZWQgPSBldmVudC50eXBlID09PSAnbW91c2V1cCcgfHwgZXZlbnQudHlwZSA9PT0gJ3RvdWNoZW5kJztcblx0XHRcdGRyYWdnaW5nLnBvaW50ZXIgPSBkcmFnZ2luZy50b3VjaCA/IGV2ZW50Lm9yaWdpbmFsRXZlbnRbZHJhZ2dpbmcucmVsZWFzZWQgPyAnY2hhbmdlZFRvdWNoZXMnIDogJ3RvdWNoZXMnXVswXSA6IGV2ZW50O1xuXHRcdFx0ZHJhZ2dpbmcucGF0aFggPSBkcmFnZ2luZy5wb2ludGVyLnBhZ2VYIC0gZHJhZ2dpbmcuaW5pdFg7XG5cdFx0XHRkcmFnZ2luZy5wYXRoWSA9IGRyYWdnaW5nLnBvaW50ZXIucGFnZVkgLSBkcmFnZ2luZy5pbml0WTtcblx0XHRcdGRyYWdnaW5nLnBhdGggPSBzcXJ0KHBvdyhkcmFnZ2luZy5wYXRoWCwgMikgKyBwb3coZHJhZ2dpbmcucGF0aFksIDIpKTtcblx0XHRcdGRyYWdnaW5nLmRlbHRhID0gby5ob3Jpem9udGFsID8gZHJhZ2dpbmcucGF0aFggOiBkcmFnZ2luZy5wYXRoWTtcblxuXHRcdFx0aWYgKCFkcmFnZ2luZy5yZWxlYXNlZCAmJiBkcmFnZ2luZy5wYXRoIDwgMSkgcmV0dXJuO1xuXG5cdFx0XHQvLyBXZSBoYXZlbid0IGRlY2lkZWQgd2hldGhlciB0aGlzIGlzIGEgZHJhZyBvciBub3QuLi5cblx0XHRcdGlmICghZHJhZ2dpbmcuaW5pdCkge1xuXHRcdFx0XHQvLyBJZiB0aGUgZHJhZyBwYXRoIHdhcyB2ZXJ5IHNob3J0LCBtYXliZSBpdCdzIG5vdCBhIGRyYWc/XG5cdFx0XHRcdGlmIChkcmFnZ2luZy5wYXRoIDwgby5kcmFnVGhyZXNob2xkKSB7XG5cdFx0XHRcdFx0Ly8gSWYgdGhlIHBvaW50ZXIgd2FzIHJlbGVhc2VkLCB0aGUgcGF0aCB3aWxsIG5vdCBiZWNvbWUgbG9uZ2VyIGFuZCBpdCdzXG5cdFx0XHRcdFx0Ly8gZGVmaW5pdGVseSBub3QgYSBkcmFnLiBJZiBub3QgcmVsZWFzZWQgeWV0LCBkZWNpZGUgb24gbmV4dCBpdGVyYXRpb25cblx0XHRcdFx0XHRyZXR1cm4gZHJhZ2dpbmcucmVsZWFzZWQgPyBkcmFnRW5kKCkgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0Ly8gSWYgZHJhZ2dpbmcgcGF0aCBpcyBzdWZmaWNpZW50bHkgbG9uZyB3ZSBjYW4gY29uZmlkZW50bHkgc3RhcnQgYSBkcmFnXG5cdFx0XHRcdFx0Ly8gaWYgZHJhZyBpcyBpbiBkaWZmZXJlbnQgZGlyZWN0aW9uIHRoYW4gc2Nyb2xsLCBpZ25vcmUgaXRcblx0XHRcdFx0XHRpZiAoby5ob3Jpem9udGFsID8gYWJzKGRyYWdnaW5nLnBhdGhYKSA+IGFicyhkcmFnZ2luZy5wYXRoWSkgOiBhYnMoZHJhZ2dpbmcucGF0aFgpIDwgYWJzKGRyYWdnaW5nLnBhdGhZKSkge1xuXHRcdFx0XHRcdFx0ZHJhZ2dpbmcuaW5pdCA9IDE7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJldHVybiBkcmFnRW5kKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHN0b3BEZWZhdWx0KGV2ZW50KTtcblxuXHRcdFx0Ly8gRGlzYWJsZSBjbGljayBvbiBhIHNvdXJjZSBlbGVtZW50LCBhcyBpdCBpcyB1bndlbGNvbWUgd2hlbiBkcmFnZ2luZ1xuXHRcdFx0aWYgKCFkcmFnZ2luZy5sb2NrZWQgJiYgZHJhZ2dpbmcucGF0aCA+IGRyYWdnaW5nLnBhdGhUb0xvY2sgJiYgZHJhZ2dpbmcuc2xpZGVlKSB7XG5cdFx0XHRcdGRyYWdnaW5nLmxvY2tlZCA9IDE7XG5cdFx0XHRcdGRyYWdnaW5nLiRzb3VyY2Uub24oY2xpY2tFdmVudCwgZGlzYWJsZU9uZUV2ZW50KTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gQ2FuY2VsIGRyYWdnaW5nIG9uIHJlbGVhc2Vcblx0XHRcdGlmIChkcmFnZ2luZy5yZWxlYXNlZCkge1xuXHRcdFx0XHRkcmFnRW5kKCk7XG5cblx0XHRcdFx0Ly8gQWRqdXN0IHBhdGggd2l0aCBhIHN3aW5nIG9uIG1vdXNlIHJlbGVhc2Vcblx0XHRcdFx0aWYgKG8ucmVsZWFzZVN3aW5nICYmIGRyYWdnaW5nLnNsaWRlZSkge1xuXHRcdFx0XHRcdGRyYWdnaW5nLnN3aW5nID0gKGRyYWdnaW5nLmRlbHRhIC0gZHJhZ2dpbmcuaGlzdG9yeVswXSkgLyA0MCAqIDMwMDtcblx0XHRcdFx0XHRkcmFnZ2luZy5kZWx0YSArPSBkcmFnZ2luZy5zd2luZztcblx0XHRcdFx0XHRkcmFnZ2luZy50d2Vlc2UgPSBhYnMoZHJhZ2dpbmcuc3dpbmcpID4gMTA7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0c2xpZGVUbyhkcmFnZ2luZy5zbGlkZWUgPyByb3VuZChkcmFnZ2luZy5pbml0UG9zIC0gZHJhZ2dpbmcuZGVsdGEpIDogaGFuZGxlVG9TbGlkZWUoZHJhZ2dpbmcuaW5pdFBvcyArIGRyYWdnaW5nLmRlbHRhKSk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3RvcHMgZHJhZ2dpbmcgYW5kIGNsZWFucyB1cCBhZnRlciBpdC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge1ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZHJhZ0VuZCgpIHtcblx0XHRcdGNsZWFySW50ZXJ2YWwoaGlzdG9yeUlEKTtcblx0XHRcdGRyYWdnaW5nLnJlbGVhc2VkID0gdHJ1ZTtcblx0XHRcdCRkb2Mub2ZmKGRyYWdnaW5nLnRvdWNoID8gZHJhZ1RvdWNoRXZlbnRzIDogZHJhZ01vdXNlRXZlbnRzLCBkcmFnSGFuZGxlcik7XG5cdFx0XHQoZHJhZ2dpbmcuc2xpZGVlID8gJHNsaWRlZSA6ICRoYW5kbGUpLnJlbW92ZUNsYXNzKG8uZHJhZ2dlZENsYXNzKTtcblxuXHRcdFx0Ly8gTWFrZSBzdXJlIHRoYXQgZGlzYWJsZU9uZUV2ZW50IGlzIG5vdCBhY3RpdmUgaW4gbmV4dCB0aWNrLlxuXHRcdFx0c2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGRyYWdnaW5nLiRzb3VyY2Uub2ZmKGNsaWNrRXZlbnQsIGRpc2FibGVPbmVFdmVudCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Ly8gTm9ybWFsbHksIHRoaXMgaXMgdHJpZ2dlcmVkIGluIHJlbmRlcigpLCBidXQgaWYgdGhlcmVcblx0XHRcdC8vIGlzIG5vdGhpbmcgdG8gcmVuZGVyLCB3ZSBoYXZlIHRvIGRvIGl0IG1hbnVhbGx5IGhlcmUuXG5cdFx0XHRpZiAocG9zLmN1ciA9PT0gcG9zLmRlc3QgJiYgZHJhZ2dpbmcuaW5pdCkge1xuXHRcdFx0XHR0cmlnZ2VyKCdtb3ZlRW5kJyk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFJlc3VtZSBvbmdvaW5nIGN5Y2xlXG5cdFx0XHRzZWxmLnJlc3VtZSgxKTtcblxuXHRcdFx0ZHJhZ2dpbmcuaW5pdCA9IDA7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ2hlY2sgd2hldGhlciBlbGVtZW50IGlzIGludGVyYWN0aXZlLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Qm9vbGVhbn1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpc0ludGVyYWN0aXZlKGVsZW1lbnQpIHtcblx0XHRcdHJldHVybiB+JC5pbkFycmF5KGVsZW1lbnQubm9kZU5hbWUsIGludGVyYWN0aXZlRWxlbWVudHMpIHx8ICQoZWxlbWVudCkuaXMoby5pbnRlcmFjdGl2ZSk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ29udGludW91cyBtb3ZlbWVudCBjbGVhbnVwIG9uIG1vdXNldXAuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtWb2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG1vdmVtZW50UmVsZWFzZUhhbmRsZXIoKSB7XG5cdFx0XHRzZWxmLnN0b3AoKTtcblx0XHRcdCRkb2Mub2ZmKCdtb3VzZXVwJywgbW92ZW1lbnRSZWxlYXNlSGFuZGxlcik7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQnV0dG9ucyBuYXZpZ2F0aW9uIGhhbmRsZXIuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0gIHtFdmVudH0gZXZlbnRcblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge1ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYnV0dG9uc0hhbmRsZXIoZXZlbnQpIHtcblx0XHRcdC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG5cdFx0XHRzdG9wRGVmYXVsdChldmVudCk7XG5cdFx0XHRzd2l0Y2ggKHRoaXMpIHtcblx0XHRcdFx0Y2FzZSAkZm9yd2FyZEJ1dHRvblswXTpcblx0XHRcdFx0Y2FzZSAkYmFja3dhcmRCdXR0b25bMF06XG5cdFx0XHRcdFx0c2VsZi5tb3ZlQnkoJGZvcndhcmRCdXR0b24uaXModGhpcykgPyBvLm1vdmVCeSA6IC1vLm1vdmVCeSk7XG5cdFx0XHRcdFx0JGRvYy5vbignbW91c2V1cCcsIG1vdmVtZW50UmVsZWFzZUhhbmRsZXIpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRcdGNhc2UgJHByZXZCdXR0b25bMF06XG5cdFx0XHRcdFx0c2VsZi5wcmV2KCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0Y2FzZSAkbmV4dEJ1dHRvblswXTpcblx0XHRcdFx0XHRzZWxmLm5leHQoKTtcblx0XHRcdFx0XHRicmVhaztcblxuXHRcdFx0XHRjYXNlICRwcmV2UGFnZUJ1dHRvblswXTpcblx0XHRcdFx0XHRzZWxmLnByZXZQYWdlKCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0Y2FzZSAkbmV4dFBhZ2VCdXR0b25bMF06XG5cdFx0XHRcdFx0c2VsZi5uZXh0UGFnZSgpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE1vdXNlIHdoZWVsIGRlbHRhIG5vcm1hbGl6YXRpb24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0gIHtFdmVudH0gZXZlbnRcblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge0ludH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBub3JtYWxpemVXaGVlbERlbHRhKGV2ZW50KSB7XG5cdFx0XHQvLyB3aGVlbERlbHRhIG5lZWRlZCBvbmx5IGZvciBJRTgtXG5cdFx0XHRzY3JvbGxpbmcuY3VyRGVsdGEgPSAoKG8uaG9yaXpvbnRhbCA/IGV2ZW50LmRlbHRhWSB8fCBldmVudC5kZWx0YVggOiBldmVudC5kZWx0YVkpIHx8IC1ldmVudC53aGVlbERlbHRhKTtcblx0XHRcdHNjcm9sbGluZy5jdXJEZWx0YSAvPSBldmVudC5kZWx0YU1vZGUgPT09IDEgPyAzIDogMTAwO1xuXHRcdFx0aWYgKCFpdGVtTmF2KSB7XG5cdFx0XHRcdHJldHVybiBzY3JvbGxpbmcuY3VyRGVsdGE7XG5cdFx0XHR9XG5cdFx0XHR0aW1lID0gK25ldyBEYXRlKCk7XG5cdFx0XHRpZiAoc2Nyb2xsaW5nLmxhc3QgPCB0aW1lIC0gc2Nyb2xsaW5nLnJlc2V0VGltZSkge1xuXHRcdFx0XHRzY3JvbGxpbmcuZGVsdGEgPSAwO1xuXHRcdFx0fVxuXHRcdFx0c2Nyb2xsaW5nLmxhc3QgPSB0aW1lO1xuXHRcdFx0c2Nyb2xsaW5nLmRlbHRhICs9IHNjcm9sbGluZy5jdXJEZWx0YTtcblx0XHRcdGlmIChhYnMoc2Nyb2xsaW5nLmRlbHRhKSA8IDEpIHtcblx0XHRcdFx0c2Nyb2xsaW5nLmZpbmFsRGVsdGEgPSAwO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c2Nyb2xsaW5nLmZpbmFsRGVsdGEgPSByb3VuZChzY3JvbGxpbmcuZGVsdGEgLyAxKTtcblx0XHRcdFx0c2Nyb2xsaW5nLmRlbHRhICU9IDE7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gc2Nyb2xsaW5nLmZpbmFsRGVsdGE7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTW91c2Ugc2Nyb2xsaW5nIGhhbmRsZXIuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0gIHtFdmVudH0gZXZlbnRcblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge1ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2Nyb2xsSGFuZGxlcihldmVudCkge1xuXHRcdFx0Ly8gTWFyayBldmVudCBhcyBvcmlnaW5hdGluZyBpbiBhIFNseSBpbnN0YW5jZVxuXHRcdFx0ZXZlbnQub3JpZ2luYWxFdmVudFtuYW1lc3BhY2VdID0gc2VsZjtcblx0XHRcdC8vIERvbid0IGhpamFjayBnbG9iYWwgc2Nyb2xsaW5nXG5cdFx0XHR2YXIgdGltZSA9ICtuZXcgRGF0ZSgpO1xuXHRcdFx0aWYgKGxhc3RHbG9iYWxXaGVlbCArIG8uc2Nyb2xsSGlqYWNrID4gdGltZSAmJiAkc2Nyb2xsU291cmNlWzBdICE9PSBkb2N1bWVudCAmJiAkc2Nyb2xsU291cmNlWzBdICE9PSB3aW5kb3cpIHtcblx0XHRcdFx0bGFzdEdsb2JhbFdoZWVsID0gdGltZTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Ly8gSWdub3JlIGlmIHRoZXJlIGlzIG5vIHNjcm9sbGluZyB0byBiZSBkb25lXG5cdFx0XHRpZiAoIW8uc2Nyb2xsQnkgfHwgcG9zLnN0YXJ0ID09PSBwb3MuZW5kKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHZhciBkZWx0YSA9IG5vcm1hbGl6ZVdoZWVsRGVsdGEoZXZlbnQub3JpZ2luYWxFdmVudCk7XG5cdFx0XHQvLyBUcmFwIHNjcm9sbGluZyBvbmx5IHdoZW4gbmVjZXNzYXJ5IGFuZC9vciByZXF1ZXN0ZWRcblx0XHRcdGlmIChvLnNjcm9sbFRyYXAgfHwgZGVsdGEgPiAwICYmIHBvcy5kZXN0IDwgcG9zLmVuZCB8fCBkZWx0YSA8IDAgJiYgcG9zLmRlc3QgPiBwb3Muc3RhcnQpIHtcblx0XHRcdFx0c3RvcERlZmF1bHQoZXZlbnQsIDEpO1xuXHRcdFx0fVxuXHRcdFx0c2VsZi5zbGlkZUJ5KG8uc2Nyb2xsQnkgKiBkZWx0YSk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU2Nyb2xsYmFyIGNsaWNrIGhhbmRsZXIuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0gIHtFdmVudH0gZXZlbnRcblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge1ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2Nyb2xsYmFySGFuZGxlcihldmVudCkge1xuXHRcdFx0Ly8gT25seSBjbGlja3Mgb24gc2Nyb2xsIGJhci4gSWdub3JlIHRoZSBoYW5kbGUuXG5cdFx0XHRpZiAoby5jbGlja0JhciAmJiBldmVudC50YXJnZXQgPT09ICRzYlswXSkge1xuXHRcdFx0XHRzdG9wRGVmYXVsdChldmVudCk7XG5cdFx0XHRcdC8vIENhbGN1bGF0ZSBuZXcgaGFuZGxlIHBvc2l0aW9uIGFuZCBzeW5jIFNMSURFRSB0byBpdFxuXHRcdFx0XHRzbGlkZVRvKGhhbmRsZVRvU2xpZGVlKChvLmhvcml6b250YWwgPyBldmVudC5wYWdlWCAtICRzYi5vZmZzZXQoKS5sZWZ0IDogZXZlbnQucGFnZVkgLSAkc2Iub2Zmc2V0KCkudG9wKSAtIGhhbmRsZVNpemUgLyAyKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogS2V5Ym9hcmQgaW5wdXQgaGFuZGxlci5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSAge0V2ZW50fSBldmVudFxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Vm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBrZXlib2FyZEhhbmRsZXIoZXZlbnQpIHtcblx0XHRcdGlmICghby5rZXlib2FyZE5hdkJ5KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0c3dpdGNoIChldmVudC53aGljaCkge1xuXHRcdFx0XHQvLyBMZWZ0IG9yIFVwXG5cdFx0XHRcdGNhc2Ugby5ob3Jpem9udGFsID8gMzcgOiAzODpcblx0XHRcdFx0XHRzdG9wRGVmYXVsdChldmVudCk7XG5cdFx0XHRcdFx0c2VsZltvLmtleWJvYXJkTmF2QnkgPT09ICdwYWdlcycgPyAncHJldlBhZ2UnIDogJ3ByZXYnXSgpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRcdC8vIFJpZ2h0IG9yIERvd25cblx0XHRcdFx0Y2FzZSBvLmhvcml6b250YWwgPyAzOSA6IDQwOlxuXHRcdFx0XHRcdHN0b3BEZWZhdWx0KGV2ZW50KTtcblx0XHRcdFx0XHRzZWxmW28ua2V5Ym9hcmROYXZCeSA9PT0gJ3BhZ2VzJyA/ICduZXh0UGFnZScgOiAnbmV4dCddKCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ2xpY2sgb24gaXRlbSBhY3RpdmF0aW9uIGhhbmRsZXIuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0gIHtFdmVudH0gZXZlbnRcblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge1ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYWN0aXZhdGVIYW5kbGVyKGV2ZW50KSB7XG5cdFx0XHQvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuXG5cdFx0XHQvLyBJZ25vcmUgY2xpY2tzIG9uIGludGVyYWN0aXZlIGVsZW1lbnRzLlxuXHRcdFx0aWYgKGlzSW50ZXJhY3RpdmUodGhpcykpIHtcblx0XHRcdFx0ZXZlbnQub3JpZ2luYWxFdmVudFtuYW1lc3BhY2UgKyAnaWdub3JlJ10gPSB0cnVlO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIElnbm9yZSBldmVudHMgdGhhdDpcblx0XHRcdC8vIC0gYXJlIG5vdCBvcmlnaW5hdGluZyBmcm9tIGRpcmVjdCBTTElERUUgY2hpbGRyZW5cblx0XHRcdC8vIC0gb3JpZ2luYXRlZCBmcm9tIGludGVyYWN0aXZlIGVsZW1lbnRzXG5cdFx0XHRpZiAodGhpcy5wYXJlbnROb2RlICE9PSAkc2xpZGVlWzBdIHx8IGV2ZW50Lm9yaWdpbmFsRXZlbnRbbmFtZXNwYWNlICsgJ2lnbm9yZSddKSByZXR1cm47XG5cblx0XHRcdHNlbGYuYWN0aXZhdGUodGhpcyk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ2xpY2sgb24gcGFnZSBidXR0b24gaGFuZGxlci5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50XG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtWb2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGFjdGl2YXRlUGFnZUhhbmRsZXIoKSB7XG5cdFx0XHQvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuXHRcdFx0Ly8gQWNjZXB0IG9ubHkgZXZlbnRzIGZyb20gZGlyZWN0IHBhZ2VzIGJhciBjaGlsZHJlbi5cblx0XHRcdGlmICh0aGlzLnBhcmVudE5vZGUgPT09ICRwYlswXSkge1xuXHRcdFx0XHRzZWxmLmFjdGl2YXRlUGFnZSgkcGFnZXMuaW5kZXgodGhpcykpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFBhdXNlIG9uIGhvdmVyIGhhbmRsZXIuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0gIHtFdmVudH0gZXZlbnRcblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge1ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcGF1c2VPbkhvdmVySGFuZGxlcihldmVudCkge1xuXHRcdFx0aWYgKG8ucGF1c2VPbkhvdmVyKSB7XG5cdFx0XHRcdHNlbGZbZXZlbnQudHlwZSA9PT0gJ21vdXNlZW50ZXInID8gJ3BhdXNlJyA6ICdyZXN1bWUnXSgyKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBUcmlnZ2VyIGNhbGxiYWNrcyBmb3IgZXZlbnQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgRXZlbnQgbmFtZS5cblx0XHQgKiBAcGFyYW0gIHtNaXhlZH0gIGFyZ1ggQXJndW1lbnRzIHBhc3NlZCB0byBjYWxsYmFja3MuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtWb2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHRyaWdnZXIobmFtZSwgYXJnMSkge1xuXHRcdFx0aWYgKGNhbGxiYWNrc1tuYW1lXSkge1xuXHRcdFx0XHRsID0gY2FsbGJhY2tzW25hbWVdLmxlbmd0aDtcblx0XHRcdFx0Ly8gQ2FsbGJhY2tzIHdpbGwgYmUgc3RvcmVkIGFuZCBleGVjdXRlZCBmcm9tIGEgdGVtcG9yYXJ5IGFycmF5IHRvIG5vdFxuXHRcdFx0XHQvLyBicmVhayB0aGUgZXhlY3V0aW9uIHF1ZXVlIHdoZW4gb25lIG9mIHRoZSBjYWxsYmFja3MgdW5iaW5kcyBpdHNlbGYuXG5cdFx0XHRcdHRtcEFycmF5Lmxlbmd0aCA9IDA7XG5cdFx0XHRcdGZvciAoaSA9IDA7IGkgPCBsOyBpKyspIHtcblx0XHRcdFx0XHR0bXBBcnJheS5wdXNoKGNhbGxiYWNrc1tuYW1lXVtpXSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gRXhlY3V0ZSB0aGUgY2FsbGJhY2tzXG5cdFx0XHRcdGZvciAoaSA9IDA7IGkgPCBsOyBpKyspIHtcblx0XHRcdFx0XHR0bXBBcnJheVtpXS5jYWxsKHNlbGYsIG5hbWUsIGFyZzEpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRGVzdHJveXMgaW5zdGFuY2UgYW5kIGV2ZXJ5dGhpbmcgaXQgY3JlYXRlZC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge1ZvaWR9XG5cdFx0ICovXG5cdFx0c2VsZi5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0Ly8gUmVtb3ZlIHRoZSByZWZlcmVuY2UgdG8gaXRzZWxmXG5cdFx0XHRTbHkucmVtb3ZlSW5zdGFuY2UoZnJhbWUpO1xuXG5cdFx0XHQvLyBVbmJpbmQgYWxsIGV2ZW50c1xuXHRcdFx0JHNjcm9sbFNvdXJjZVxuXHRcdFx0XHQuYWRkKCRoYW5kbGUpXG5cdFx0XHRcdC5hZGQoJHNiKVxuXHRcdFx0XHQuYWRkKCRwYilcblx0XHRcdFx0LmFkZCgkZm9yd2FyZEJ1dHRvbilcblx0XHRcdFx0LmFkZCgkYmFja3dhcmRCdXR0b24pXG5cdFx0XHRcdC5hZGQoJHByZXZCdXR0b24pXG5cdFx0XHRcdC5hZGQoJG5leHRCdXR0b24pXG5cdFx0XHRcdC5hZGQoJHByZXZQYWdlQnV0dG9uKVxuXHRcdFx0XHQuYWRkKCRuZXh0UGFnZUJ1dHRvbilcblx0XHRcdFx0Lm9mZignLicgKyBuYW1lc3BhY2UpO1xuXG5cdFx0XHQvLyBVbmJpbmRpbmcgc3BlY2lmaWNhbGx5IGFzIHRvIG5vdCBudWtlIG91dCBvdGhlciBpbnN0YW5jZXNcblx0XHRcdCRkb2Mub2ZmKCdrZXlkb3duJywga2V5Ym9hcmRIYW5kbGVyKTtcblxuXHRcdFx0Ly8gUmVtb3ZlIGNsYXNzZXNcblx0XHRcdCRwcmV2QnV0dG9uXG5cdFx0XHRcdC5hZGQoJG5leHRCdXR0b24pXG5cdFx0XHRcdC5hZGQoJHByZXZQYWdlQnV0dG9uKVxuXHRcdFx0XHQuYWRkKCRuZXh0UGFnZUJ1dHRvbilcblx0XHRcdFx0LnJlbW92ZUNsYXNzKG8uZGlzYWJsZWRDbGFzcyk7XG5cblx0XHRcdGlmICgkaXRlbXMgJiYgcmVsLmFjdGl2ZUl0ZW0gIT0gbnVsbCkge1xuXHRcdFx0XHQkaXRlbXMuZXEocmVsLmFjdGl2ZUl0ZW0pLnJlbW92ZUNsYXNzKG8uYWN0aXZlQ2xhc3MpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBSZW1vdmUgcGFnZSBpdGVtc1xuXHRcdFx0JHBiLmVtcHR5KCk7XG5cblx0XHRcdGlmICghcGFyYWxsYXgpIHtcblx0XHRcdFx0Ly8gVW5iaW5kIGV2ZW50cyBmcm9tIGZyYW1lXG5cdFx0XHRcdCRmcmFtZS5vZmYoJy4nICsgbmFtZXNwYWNlKTtcblx0XHRcdFx0Ly8gUmVzdG9yZSBvcmlnaW5hbCBzdHlsZXNcblx0XHRcdFx0ZnJhbWVTdHlsZXMucmVzdG9yZSgpO1xuXHRcdFx0XHRzbGlkZWVTdHlsZXMucmVzdG9yZSgpO1xuXHRcdFx0XHRzYlN0eWxlcy5yZXN0b3JlKCk7XG5cdFx0XHRcdGhhbmRsZVN0eWxlcy5yZXN0b3JlKCk7XG5cdFx0XHRcdC8vIFJlbW92ZSB0aGUgaW5zdGFuY2UgZnJvbSBlbGVtZW50IGRhdGEgc3RvcmFnZVxuXHRcdFx0XHQkLnJlbW92ZURhdGEoZnJhbWUsIG5hbWVzcGFjZSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIENsZWFuIHVwIGNvbGxlY3Rpb25zXG5cdFx0XHRpdGVtcy5sZW5ndGggPSBwYWdlcy5sZW5ndGggPSAwO1xuXHRcdFx0bGFzdCA9IHt9O1xuXG5cdFx0XHQvLyBSZXNldCBpbml0aWFsaXplZCBzdGF0dXMgYW5kIHJldHVybiB0aGUgaW5zdGFuY2Vcblx0XHRcdHNlbGYuaW5pdGlhbGl6ZWQgPSAwO1xuXHRcdFx0cmV0dXJuIHNlbGY7XG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdCAqIEluaXRpYWxpemUuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9XG5cdFx0ICovXG5cdFx0c2VsZi5pbml0ID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0aWYgKHNlbGYuaW5pdGlhbGl6ZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBEaXNhbGxvdyBtdWx0aXBsZSBpbnN0YW5jZXMgb24gdGhlIHNhbWUgZWxlbWVudFxuXHRcdFx0aWYgKFNseS5nZXRJbnN0YW5jZShmcmFtZSkpIHRocm93IG5ldyBFcnJvcignVGhlcmUgaXMgYWxyZWFkeSBhIFNseSBpbnN0YW5jZSBvbiB0aGlzIGVsZW1lbnQnKTtcblxuXHRcdFx0Ly8gU3RvcmUgdGhlIHJlZmVyZW5jZSB0byBpdHNlbGZcblx0XHRcdFNseS5zdG9yZUluc3RhbmNlKGZyYW1lLCBzZWxmKTtcblxuXHRcdFx0Ly8gUmVnaXN0ZXIgY2FsbGJhY2tzIG1hcFxuXHRcdFx0c2VsZi5vbihjYWxsYmFja01hcCk7XG5cblx0XHRcdC8vIFNhdmUgc3R5bGVzXG5cdFx0XHR2YXIgaG9sZGVyUHJvcHMgPSBbJ292ZXJmbG93JywgJ3Bvc2l0aW9uJ107XG5cdFx0XHR2YXIgbW92YWJsZVByb3BzID0gWydwb3NpdGlvbicsICd3ZWJraXRUcmFuc2Zvcm0nLCAnbXNUcmFuc2Zvcm0nLCAndHJhbnNmb3JtJywgJ2xlZnQnLCAndG9wJywgJ3dpZHRoJywgJ2hlaWdodCddO1xuXHRcdFx0ZnJhbWVTdHlsZXMuc2F2ZS5hcHBseShmcmFtZVN0eWxlcywgaG9sZGVyUHJvcHMpO1xuXHRcdFx0c2JTdHlsZXMuc2F2ZS5hcHBseShzYlN0eWxlcywgaG9sZGVyUHJvcHMpO1xuXHRcdFx0c2xpZGVlU3R5bGVzLnNhdmUuYXBwbHkoc2xpZGVlU3R5bGVzLCBtb3ZhYmxlUHJvcHMpO1xuXHRcdFx0aGFuZGxlU3R5bGVzLnNhdmUuYXBwbHkoaGFuZGxlU3R5bGVzLCBtb3ZhYmxlUHJvcHMpO1xuXG5cdFx0XHQvLyBTZXQgcmVxdWlyZWQgc3R5bGVzXG5cdFx0XHR2YXIgJG1vdmFibGVzID0gJGhhbmRsZTtcblx0XHRcdGlmICghcGFyYWxsYXgpIHtcblx0XHRcdFx0JG1vdmFibGVzID0gJG1vdmFibGVzLmFkZCgkc2xpZGVlKTtcblx0XHRcdFx0JGZyYW1lLmNzcygnb3ZlcmZsb3cnLCAnaGlkZGVuJyk7XG5cdFx0XHRcdGlmICghdHJhbnNmb3JtICYmICRmcmFtZS5jc3MoJ3Bvc2l0aW9uJykgPT09ICdzdGF0aWMnKSB7XG5cdFx0XHRcdFx0JGZyYW1lLmNzcygncG9zaXRpb24nLCAncmVsYXRpdmUnKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKHRyYW5zZm9ybSkge1xuXHRcdFx0XHRpZiAoZ3B1QWNjZWxlcmF0aW9uKSB7XG5cdFx0XHRcdFx0JG1vdmFibGVzLmNzcyh0cmFuc2Zvcm0sIGdwdUFjY2VsZXJhdGlvbik7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmICgkc2IuY3NzKCdwb3NpdGlvbicpID09PSAnc3RhdGljJykge1xuXHRcdFx0XHRcdCRzYi5jc3MoJ3Bvc2l0aW9uJywgJ3JlbGF0aXZlJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0JG1vdmFibGVzLmNzcyh7IHBvc2l0aW9uOiAnYWJzb2x1dGUnIH0pO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBOYXZpZ2F0aW9uIGJ1dHRvbnNcblx0XHRcdGlmIChvLmZvcndhcmQpIHtcblx0XHRcdFx0JGZvcndhcmRCdXR0b24ub24obW91c2VEb3duRXZlbnQsIGJ1dHRvbnNIYW5kbGVyKTtcblx0XHRcdH1cblx0XHRcdGlmIChvLmJhY2t3YXJkKSB7XG5cdFx0XHRcdCRiYWNrd2FyZEJ1dHRvbi5vbihtb3VzZURvd25FdmVudCwgYnV0dG9uc0hhbmRsZXIpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKG8ucHJldikge1xuXHRcdFx0XHQkcHJldkJ1dHRvbi5vbihjbGlja0V2ZW50LCBidXR0b25zSGFuZGxlcik7XG5cdFx0XHR9XG5cdFx0XHRpZiAoby5uZXh0KSB7XG5cdFx0XHRcdCRuZXh0QnV0dG9uLm9uKGNsaWNrRXZlbnQsIGJ1dHRvbnNIYW5kbGVyKTtcblx0XHRcdH1cblx0XHRcdGlmIChvLnByZXZQYWdlKSB7XG5cdFx0XHRcdCRwcmV2UGFnZUJ1dHRvbi5vbihjbGlja0V2ZW50LCBidXR0b25zSGFuZGxlcik7XG5cdFx0XHR9XG5cdFx0XHRpZiAoby5uZXh0UGFnZSkge1xuXHRcdFx0XHQkbmV4dFBhZ2VCdXR0b24ub24oY2xpY2tFdmVudCwgYnV0dG9uc0hhbmRsZXIpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBTY3JvbGxpbmcgbmF2aWdhdGlvblxuXHRcdFx0JHNjcm9sbFNvdXJjZS5vbih3aGVlbEV2ZW50LCBzY3JvbGxIYW5kbGVyKTtcblxuXHRcdFx0Ly8gQ2xpY2tpbmcgb24gc2Nyb2xsYmFyIG5hdmlnYXRpb25cblx0XHRcdGlmICgkc2JbMF0pIHtcblx0XHRcdFx0JHNiLm9uKGNsaWNrRXZlbnQsIHNjcm9sbGJhckhhbmRsZXIpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBDbGljayBvbiBpdGVtcyBuYXZpZ2F0aW9uXG5cdFx0XHRpZiAoaXRlbU5hdiAmJiBvLmFjdGl2YXRlT24pIHtcblx0XHRcdFx0JGZyYW1lLm9uKG8uYWN0aXZhdGVPbiArICcuJyArIG5hbWVzcGFjZSwgJyonLCBhY3RpdmF0ZUhhbmRsZXIpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBQYWdlcyBuYXZpZ2F0aW9uXG5cdFx0XHRpZiAoJHBiWzBdICYmIG8uYWN0aXZhdGVQYWdlT24pIHtcblx0XHRcdFx0JHBiLm9uKG8uYWN0aXZhdGVQYWdlT24gKyAnLicgKyBuYW1lc3BhY2UsICcqJywgYWN0aXZhdGVQYWdlSGFuZGxlcik7XG5cdFx0XHR9XG5cblx0XHRcdC8vIERyYWdnaW5nIG5hdmlnYXRpb25cblx0XHRcdCRkcmFnU291cmNlLm9uKGRyYWdJbml0RXZlbnRzLCB7IHNvdXJjZTogJ3NsaWRlZScgfSwgZHJhZ0luaXQpO1xuXG5cdFx0XHQvLyBTY3JvbGxiYXIgZHJhZ2dpbmcgbmF2aWdhdGlvblxuXHRcdFx0aWYgKCRoYW5kbGUpIHtcblx0XHRcdFx0JGhhbmRsZS5vbihkcmFnSW5pdEV2ZW50cywgeyBzb3VyY2U6ICdoYW5kbGUnIH0sIGRyYWdJbml0KTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gS2V5Ym9hcmQgbmF2aWdhdGlvblxuXHRcdFx0JGRvYy5vbigna2V5ZG93bicsIGtleWJvYXJkSGFuZGxlcik7XG5cblx0XHRcdGlmICghcGFyYWxsYXgpIHtcblx0XHRcdFx0Ly8gUGF1c2Ugb24gaG92ZXJcblx0XHRcdFx0JGZyYW1lLm9uKCdtb3VzZWVudGVyLicgKyBuYW1lc3BhY2UgKyAnIG1vdXNlbGVhdmUuJyArIG5hbWVzcGFjZSwgcGF1c2VPbkhvdmVySGFuZGxlcik7XG5cdFx0XHRcdC8vIFJlc2V0IG5hdGl2ZSBGUkFNRSBlbGVtZW50IHNjcm9sbFxuXHRcdFx0XHQkZnJhbWUub24oJ3Njcm9sbC4nICsgbmFtZXNwYWNlLCByZXNldFNjcm9sbCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIE1hcmsgaW5zdGFuY2UgYXMgaW5pdGlhbGl6ZWRcblx0XHRcdHNlbGYuaW5pdGlhbGl6ZWQgPSAxO1xuXG5cdFx0XHQvLyBMb2FkXG5cdFx0XHRsb2FkKHRydWUpO1xuXG5cdFx0XHQvLyBJbml0aWF0ZSBhdXRvbWF0aWMgY3ljbGluZ1xuXHRcdFx0aWYgKG8uY3ljbGVCeSAmJiAhcGFyYWxsYXgpIHtcblx0XHRcdFx0c2VsZltvLnN0YXJ0UGF1c2VkID8gJ3BhdXNlJyA6ICdyZXN1bWUnXSgpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBSZXR1cm4gaW5zdGFuY2Vcblx0XHRcdHJldHVybiBzZWxmO1xuXHRcdH07XG5cdH1cblxuXHRTbHkuZ2V0SW5zdGFuY2UgPSBmdW5jdGlvbiAoZWxlbWVudCkge1xuXHRcdHJldHVybiAkLmRhdGEoZWxlbWVudCwgbmFtZXNwYWNlKTtcblx0fTtcblxuXHRTbHkuc3RvcmVJbnN0YW5jZSA9IGZ1bmN0aW9uIChlbGVtZW50LCBzbHkpIHtcblx0XHRyZXR1cm4gJC5kYXRhKGVsZW1lbnQsIG5hbWVzcGFjZSwgc2x5KTtcblx0fTtcblxuXHRTbHkucmVtb3ZlSW5zdGFuY2UgPSBmdW5jdGlvbiAoZWxlbWVudCkge1xuXHRcdHJldHVybiAkLnJlbW92ZURhdGEoZWxlbWVudCwgbmFtZXNwYWNlKTtcblx0fTtcblxuXHQvKipcblx0ICogUmV0dXJuIHR5cGUgb2YgdGhlIHZhbHVlLlxuXHQgKlxuXHQgKiBAcGFyYW0gIHtNaXhlZH0gdmFsdWVcblx0ICpcblx0ICogQHJldHVybiB7U3RyaW5nfVxuXHQgKi9cblx0ZnVuY3Rpb24gdHlwZSh2YWx1ZSkge1xuXHRcdGlmICh2YWx1ZSA9PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gU3RyaW5nKHZhbHVlKTtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyB8fCB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpLm1hdGNoKC9cXHMoW2Etel0rKS9pKVsxXS50b0xvd2VyQ2FzZSgpIHx8ICdvYmplY3QnO1xuXHRcdH1cblxuXHRcdHJldHVybiB0eXBlb2YgdmFsdWU7XG5cdH1cblxuXHQvKipcblx0ICogRXZlbnQgcHJldmVudERlZmF1bHQgJiBzdG9wUHJvcGFnYXRpb24gaGVscGVyLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudCAgICAgRXZlbnQgb2JqZWN0LlxuXHQgKiBAcGFyYW0ge0Jvb2x9ICBub0J1YmJsZXMgQ2FuY2VsIGV2ZW50IGJ1YmJsaW5nLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtWb2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3RvcERlZmF1bHQoZXZlbnQsIG5vQnViYmxlcykge1xuXHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0aWYgKG5vQnViYmxlcykge1xuXHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIERpc2FibGVzIGFuIGV2ZW50IGl0IHdhcyB0cmlnZ2VyZWQgb24gYW5kIHVuYmluZHMgaXRzZWxmLlxuXHQgKlxuXHQgKiBAcGFyYW0gIHtFdmVudH0gZXZlbnRcblx0ICpcblx0ICogQHJldHVybiB7Vm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGRpc2FibGVPbmVFdmVudChldmVudCkge1xuXHRcdC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG5cdFx0c3RvcERlZmF1bHQoZXZlbnQsIDEpO1xuXHRcdCQodGhpcykub2ZmKGV2ZW50LnR5cGUsIGRpc2FibGVPbmVFdmVudCk7XG5cdH1cblxuXHQvKipcblx0ICogUmVzZXRzIG5hdGl2ZSBlbGVtZW50IHNjcm9sbCB2YWx1ZXMgdG8gMC5cblx0ICpcblx0ICogQHJldHVybiB7Vm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHJlc2V0U2Nyb2xsKCkge1xuXHRcdC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG5cdFx0dGhpcy5zY3JvbGxMZWZ0ID0gMDtcblx0XHR0aGlzLnNjcm9sbFRvcCA9IDA7XG5cdH1cblxuXHQvKipcblx0ICogQ2hlY2sgaWYgdmFyaWFibGUgaXMgYSBudW1iZXIuXG5cdCAqXG5cdCAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG5cdCAqXG5cdCAqIEByZXR1cm4ge0Jvb2xlYW59XG5cdCAqL1xuXHRmdW5jdGlvbiBpc051bWJlcih2YWx1ZSkge1xuXHRcdHJldHVybiAhaXNOYU4ocGFyc2VGbG9hdCh2YWx1ZSkpICYmIGlzRmluaXRlKHZhbHVlKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBQYXJzZSBzdHlsZSB0byBwaXhlbHMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICRpdGVtICAgIGpRdWVyeSBvYmplY3Qgd2l0aCBlbGVtZW50LlxuXHQgKiBAcGFyYW0ge1Byb3BlcnR5fSBwcm9wZXJ0eSBDU1MgcHJvcGVydHkgdG8gZ2V0IHRoZSBwaXhlbHMgZnJvbS5cblx0ICpcblx0ICogQHJldHVybiB7SW50fVxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0UHgoJGl0ZW0sIHByb3BlcnR5KSB7XG5cdFx0cmV0dXJuIDAgfCByb3VuZChTdHJpbmcoJGl0ZW0uY3NzKHByb3BlcnR5KSkucmVwbGFjZSgvW15cXC0wLTkuXS9nLCAnJykpO1xuXHR9XG5cblx0LyoqXG5cdCAqIE1ha2Ugc3VyZSB0aGF0IG51bWJlciBpcyB3aXRoaW4gdGhlIGxpbWl0cy5cblx0ICpcblx0ICogQHBhcmFtIHtOdW1iZXJ9IG51bWJlclxuXHQgKiBAcGFyYW0ge051bWJlcn0gbWluXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBtYXhcblx0ICpcblx0ICogQHJldHVybiB7TnVtYmVyfVxuXHQgKi9cblx0ZnVuY3Rpb24gd2l0aGluKG51bWJlciwgbWluLCBtYXgpIHtcblx0XHRyZXR1cm4gbnVtYmVyIDwgbWluID8gbWluIDogbnVtYmVyID4gbWF4ID8gbWF4IDogbnVtYmVyO1xuXHR9XG5cblx0LyoqXG5cdCAqIFNhdmVzIGVsZW1lbnQgc3R5bGVzIGZvciBsYXRlciByZXN0b3JhdGlvbi5cblx0ICpcblx0ICogRXhhbXBsZTpcblx0ICogICB2YXIgc3R5bGVzID0gbmV3IFN0eWxlUmVzdG9yZXIoZnJhbWUpO1xuXHQgKiAgIHN0eWxlcy5zYXZlKCdwb3NpdGlvbicpO1xuXHQgKiAgIGVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuXHQgKiAgIHN0eWxlcy5yZXN0b3JlKCk7IC8vIHJlc3RvcmVzIHRvIHN0YXRlIGJlZm9yZSB0aGUgYXNzaWdubWVudCBhYm92ZVxuXHQgKlxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IGVsZW1lbnRcblx0ICovXG5cdGZ1bmN0aW9uIFN0eWxlUmVzdG9yZXIoZWxlbWVudCkge1xuXHRcdHZhciBzZWxmID0ge307XG5cdFx0c2VsZi5zdHlsZSA9IHt9O1xuXHRcdHNlbGYuc2F2ZSA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdGlmICghZWxlbWVudCB8fCAhZWxlbWVudC5ub2RlVHlwZSkgcmV0dXJuO1xuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0c2VsZi5zdHlsZVthcmd1bWVudHNbaV1dID0gZWxlbWVudC5zdHlsZVthcmd1bWVudHNbaV1dO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHNlbGY7XG5cdFx0fTtcblx0XHRzZWxmLnJlc3RvcmUgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRpZiAoIWVsZW1lbnQgfHwgIWVsZW1lbnQubm9kZVR5cGUpIHJldHVybjtcblx0XHRcdGZvciAodmFyIHByb3AgaW4gc2VsZi5zdHlsZSkge1xuXHRcdFx0XHRpZiAoc2VsZi5zdHlsZS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkgZWxlbWVudC5zdHlsZVtwcm9wXSA9IHNlbGYuc3R5bGVbcHJvcF07XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gc2VsZjtcblx0XHR9O1xuXHRcdHJldHVybiBzZWxmO1xuXHR9XG5cblx0Ly8gTG9jYWwgV2luZG93QW5pbWF0aW9uVGltaW5nIGludGVyZmFjZSBwb2x5ZmlsbFxuXHQoZnVuY3Rpb24gKHcpIHtcblx0XHRyQUYgPSB3LnJlcXVlc3RBbmltYXRpb25GcmFtZVxuXHRcdFx0fHwgdy53ZWJraXRSZXF1ZXN0QW5pbWF0aW9uRnJhbWVcblx0XHRcdHx8IGZhbGxiYWNrO1xuXG5cdFx0LyoqXG5cdFx0KiBGYWxsYmFjayBpbXBsZW1lbnRhdGlvbi5cblx0XHQqL1xuXHRcdHZhciBwcmV2ID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG5cdFx0ZnVuY3Rpb24gZmFsbGJhY2soZm4pIHtcblx0XHRcdHZhciBjdXJyID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG5cdFx0XHR2YXIgbXMgPSBNYXRoLm1heCgwLCAxNiAtIChjdXJyIC0gcHJldikpO1xuXHRcdFx0dmFyIHJlcSA9IHNldFRpbWVvdXQoZm4sIG1zKTtcblx0XHRcdHByZXYgPSBjdXJyO1xuXHRcdFx0cmV0dXJuIHJlcTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQqIENhbmNlbC5cblx0XHQqL1xuXHRcdHZhciBjYW5jZWwgPSB3LmNhbmNlbEFuaW1hdGlvbkZyYW1lXG5cdFx0XHR8fCB3LndlYmtpdENhbmNlbEFuaW1hdGlvbkZyYW1lXG5cdFx0XHR8fCB3LmNsZWFyVGltZW91dDtcblxuXHRcdGNBRiA9IGZ1bmN0aW9uKGlkKXtcblx0XHRcdGNhbmNlbC5jYWxsKHcsIGlkKTtcblx0XHR9O1xuXHR9KHdpbmRvdykpO1xuXG5cdC8vIEZlYXR1cmUgZGV0ZWN0c1xuXHQoZnVuY3Rpb24gKCkge1xuXHRcdHZhciBwcmVmaXhlcyA9IFsnJywgJ1dlYmtpdCcsICdNb3onLCAnbXMnLCAnTyddO1xuXHRcdHZhciBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG5cdFx0ZnVuY3Rpb24gdGVzdFByb3AocHJvcCkge1xuXHRcdFx0Zm9yICh2YXIgcCA9IDAsIHBsID0gcHJlZml4ZXMubGVuZ3RoOyBwIDwgcGw7IHArKykge1xuXHRcdFx0XHR2YXIgcHJlZml4ZWRQcm9wID0gcHJlZml4ZXNbcF0gPyBwcmVmaXhlc1twXSArIHByb3AuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBwcm9wLnNsaWNlKDEpIDogcHJvcDtcblx0XHRcdFx0aWYgKGVsLnN0eWxlW3ByZWZpeGVkUHJvcF0gIT0gbnVsbCkge1xuXHRcdFx0XHRcdHJldHVybiBwcmVmaXhlZFByb3A7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBHbG9iYWwgc3VwcG9ydCBpbmRpY2F0b3JzXG5cdFx0dHJhbnNmb3JtID0gdGVzdFByb3AoJ3RyYW5zZm9ybScpO1xuXHRcdGdwdUFjY2VsZXJhdGlvbiA9IHRlc3RQcm9wKCdwZXJzcGVjdGl2ZScpID8gJ3RyYW5zbGF0ZVooMCkgJyA6ICcnO1xuXHR9KCkpO1xuXG5cdC8vIEV4cG9zZSBjbGFzcyBnbG9iYWxseVxuXHR3W2NsYXNzTmFtZV0gPSBTbHk7XG5cblx0Ly8galF1ZXJ5IHByb3h5XG5cdCQuZm5bcGx1Z2luTmFtZV0gPSBmdW5jdGlvbiAob3B0aW9ucywgY2FsbGJhY2tNYXApIHtcblx0XHR2YXIgbWV0aG9kLCBtZXRob2RBcmdzO1xuXG5cdFx0Ly8gQXR0cmlidXRlcyBsb2dpY1xuXHRcdGlmICghJC5pc1BsYWluT2JqZWN0KG9wdGlvbnMpKSB7XG5cdFx0XHRpZiAodHlwZShvcHRpb25zKSA9PT0gJ3N0cmluZycgfHwgb3B0aW9ucyA9PT0gZmFsc2UpIHtcblx0XHRcdFx0bWV0aG9kID0gb3B0aW9ucyA9PT0gZmFsc2UgPyAnZGVzdHJveScgOiBvcHRpb25zO1xuXHRcdFx0XHRtZXRob2RBcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblx0XHRcdH1cblx0XHRcdG9wdGlvbnMgPSB7fTtcblx0XHR9XG5cblx0XHQvLyBBcHBseSB0byBhbGwgZWxlbWVudHNcblx0XHRyZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uIChpLCBlbGVtZW50KSB7XG5cdFx0XHQvLyBDYWxsIHdpdGggcHJldmVudGlvbiBhZ2FpbnN0IG11bHRpcGxlIGluc3RhbnRpYXRpb25zXG5cdFx0XHR2YXIgcGx1Z2luID0gU2x5LmdldEluc3RhbmNlKGVsZW1lbnQpO1xuXG5cdFx0XHRpZiAoIXBsdWdpbiAmJiAhbWV0aG9kKSB7XG5cdFx0XHRcdC8vIENyZWF0ZSBhIG5ldyBvYmplY3QgaWYgaXQgZG9lc24ndCBleGlzdCB5ZXRcblx0XHRcdFx0cGx1Z2luID0gbmV3IFNseShlbGVtZW50LCBvcHRpb25zLCBjYWxsYmFja01hcCkuaW5pdCgpO1xuXHRcdFx0fSBlbHNlIGlmIChwbHVnaW4gJiYgbWV0aG9kKSB7XG5cdFx0XHRcdC8vIENhbGwgbWV0aG9kXG5cdFx0XHRcdGlmIChwbHVnaW5bbWV0aG9kXSkge1xuXHRcdFx0XHRcdHBsdWdpblttZXRob2RdLmFwcGx5KHBsdWdpbiwgbWV0aG9kQXJncyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0fTtcblxuXHQvLyBEZWZhdWx0IG9wdGlvbnNcblx0U2x5LmRlZmF1bHRzID0ge1xuXHRcdHNsaWRlZTogICAgIG51bGwsICAvLyBTZWxlY3RvciwgRE9NIGVsZW1lbnQsIG9yIGpRdWVyeSBvYmplY3Qgd2l0aCBET00gZWxlbWVudCByZXByZXNlbnRpbmcgU0xJREVFLlxuXHRcdGhvcml6b250YWw6IGZhbHNlLCAvLyBTd2l0Y2ggdG8gaG9yaXpvbnRhbCBtb2RlLlxuXG5cdFx0Ly8gSXRlbSBiYXNlZCBuYXZpZ2F0aW9uXG5cdFx0aXRlbU5hdjogICAgICAgIG51bGwsICAvLyBJdGVtIG5hdmlnYXRpb24gdHlwZS4gQ2FuIGJlOiAnYmFzaWMnLCAnY2VudGVyZWQnLCAnZm9yY2VDZW50ZXJlZCcuXG5cdFx0aXRlbVNlbGVjdG9yOiAgIG51bGwsICAvLyBTZWxlY3Qgb25seSBpdGVtcyB0aGF0IG1hdGNoIHRoaXMgc2VsZWN0b3IuXG5cdFx0c21hcnQ6ICAgICAgICAgIGZhbHNlLCAvLyBSZXBvc2l0aW9ucyB0aGUgYWN0aXZhdGVkIGl0ZW0gdG8gaGVscCB3aXRoIGZ1cnRoZXIgbmF2aWdhdGlvbi5cblx0XHRhY3RpdmF0ZU9uOiAgICAgbnVsbCwgIC8vIEFjdGl2YXRlIGFuIGl0ZW0gb24gdGhpcyBldmVudC4gQ2FuIGJlOiAnY2xpY2snLCAnbW91c2VlbnRlcicsIC4uLlxuXHRcdGFjdGl2YXRlTWlkZGxlOiBmYWxzZSwgLy8gQWx3YXlzIGFjdGl2YXRlIHRoZSBpdGVtIGluIHRoZSBtaWRkbGUgb2YgdGhlIEZSQU1FLiBmb3JjZUNlbnRlcmVkIG9ubHkuXG5cblx0XHQvLyBTY3JvbGxpbmdcblx0XHRzY3JvbGxTb3VyY2U6IG51bGwsICAvLyBFbGVtZW50IGZvciBjYXRjaGluZyB0aGUgbW91c2Ugd2hlZWwgc2Nyb2xsaW5nLiBEZWZhdWx0IGlzIEZSQU1FLlxuXHRcdHNjcm9sbEJ5OiAgICAgMCwgICAgIC8vIFBpeGVscyBvciBpdGVtcyB0byBtb3ZlIHBlciBvbmUgbW91c2Ugc2Nyb2xsLiAwIHRvIGRpc2FibGUgc2Nyb2xsaW5nLlxuXHRcdHNjcm9sbEhpamFjazogMzAwLCAgIC8vIE1pbGxpc2Vjb25kcyBzaW5jZSBsYXN0IHdoZWVsIGV2ZW50IGFmdGVyIHdoaWNoIGl0IGlzIGFjY2VwdGFibGUgdG8gaGlqYWNrIGdsb2JhbCBzY3JvbGwuXG5cdFx0c2Nyb2xsVHJhcDogICBmYWxzZSwgLy8gRG9uJ3QgYnViYmxlIHNjcm9sbGluZyB3aGVuIGhpdHRpbmcgc2Nyb2xsaW5nIGxpbWl0cy5cblxuXHRcdC8vIERyYWdnaW5nXG5cdFx0ZHJhZ1NvdXJjZTogICAgbnVsbCwgIC8vIFNlbGVjdG9yIG9yIERPTSBlbGVtZW50IGZvciBjYXRjaGluZyBkcmFnZ2luZyBldmVudHMuIERlZmF1bHQgaXMgRlJBTUUuXG5cdFx0bW91c2VEcmFnZ2luZzogZmFsc2UsIC8vIEVuYWJsZSBuYXZpZ2F0aW9uIGJ5IGRyYWdnaW5nIHRoZSBTTElERUUgd2l0aCBtb3VzZSBjdXJzb3IuXG5cdFx0dG91Y2hEcmFnZ2luZzogZmFsc2UsIC8vIEVuYWJsZSBuYXZpZ2F0aW9uIGJ5IGRyYWdnaW5nIHRoZSBTTElERUUgd2l0aCB0b3VjaCBldmVudHMuXG5cdFx0cmVsZWFzZVN3aW5nOiAgZmFsc2UsIC8vIEVhc2Ugb3V0IG9uIGRyYWdnaW5nIHN3aW5nIHJlbGVhc2UuXG5cdFx0c3dpbmdTcGVlZDogICAgMC4yLCAgIC8vIFN3aW5nIHN5bmNocm9uaXphdGlvbiBzcGVlZCwgd2hlcmU6IDEgPSBpbnN0YW50LCAwID0gaW5maW5pdGUuXG5cdFx0ZWxhc3RpY0JvdW5kczogZmFsc2UsIC8vIFN0cmV0Y2ggU0xJREVFIHBvc2l0aW9uIGxpbWl0cyB3aGVuIGRyYWdnaW5nIHBhc3QgRlJBTUUgYm91bmRhcmllcy5cblx0XHRkcmFnVGhyZXNob2xkOiAzLCAgICAgLy8gRGlzdGFuY2UgaW4gcGl4ZWxzIGJlZm9yZSBTbHkgcmVjb2duaXplcyBkcmFnZ2luZy5cblx0XHRpbnRlcmFjdGl2ZTogICBudWxsLCAgLy8gU2VsZWN0b3IgZm9yIHNwZWNpYWwgaW50ZXJhY3RpdmUgZWxlbWVudHMuXG5cblx0XHQvLyBTY3JvbGxiYXJcblx0XHRzY3JvbGxCYXI6ICAgICBudWxsLCAgLy8gU2VsZWN0b3Igb3IgRE9NIGVsZW1lbnQgZm9yIHNjcm9sbGJhciBjb250YWluZXIuXG5cdFx0ZHJhZ0hhbmRsZTogICAgZmFsc2UsIC8vIFdoZXRoZXIgdGhlIHNjcm9sbGJhciBoYW5kbGUgc2hvdWxkIGJlIGRyYWdnYWJsZS5cblx0XHRkeW5hbWljSGFuZGxlOiBmYWxzZSwgLy8gU2Nyb2xsYmFyIGhhbmRsZSByZXByZXNlbnRzIHRoZSByYXRpbyBiZXR3ZWVuIGhpZGRlbiBhbmQgdmlzaWJsZSBjb250ZW50LlxuXHRcdG1pbkhhbmRsZVNpemU6IDUwLCAgICAvLyBNaW5pbWFsIGhlaWdodCBvciB3aWR0aCAoZGVwZW5kcyBvbiBzbHkgZGlyZWN0aW9uKSBvZiBhIGhhbmRsZSBpbiBwaXhlbHMuXG5cdFx0Y2xpY2tCYXI6ICAgICAgZmFsc2UsIC8vIEVuYWJsZSBuYXZpZ2F0aW9uIGJ5IGNsaWNraW5nIG9uIHNjcm9sbGJhci5cblx0XHRzeW5jU3BlZWQ6ICAgICAwLjUsICAgLy8gSGFuZGxlID0+IFNMSURFRSBzeW5jaHJvbml6YXRpb24gc3BlZWQsIHdoZXJlOiAxID0gaW5zdGFudCwgMCA9IGluZmluaXRlLlxuXG5cdFx0Ly8gUGFnZXNiYXJcblx0XHRwYWdlc0JhcjogICAgICAgbnVsbCwgLy8gU2VsZWN0b3Igb3IgRE9NIGVsZW1lbnQgZm9yIHBhZ2VzIGJhciBjb250YWluZXIuXG5cdFx0YWN0aXZhdGVQYWdlT246IG51bGwsIC8vIEV2ZW50IHVzZWQgdG8gYWN0aXZhdGUgcGFnZS4gQ2FuIGJlOiBjbGljaywgbW91c2VlbnRlciwgLi4uXG5cdFx0cGFnZUJ1aWxkZXI6ICAgICAgICAgIC8vIFBhZ2UgaXRlbSBnZW5lcmF0b3IuXG5cdFx0XHRmdW5jdGlvbiAoaW5kZXgpIHtcblx0XHRcdFx0cmV0dXJuICc8bGk+JyArIChpbmRleCArIDEpICsgJzwvbGk+Jztcblx0XHRcdH0sXG5cblx0XHQvLyBOYXZpZ2F0aW9uIGJ1dHRvbnNcblx0XHRmb3J3YXJkOiAgbnVsbCwgLy8gU2VsZWN0b3Igb3IgRE9NIGVsZW1lbnQgZm9yIFwiZm9yd2FyZCBtb3ZlbWVudFwiIGJ1dHRvbi5cblx0XHRiYWNrd2FyZDogbnVsbCwgLy8gU2VsZWN0b3Igb3IgRE9NIGVsZW1lbnQgZm9yIFwiYmFja3dhcmQgbW92ZW1lbnRcIiBidXR0b24uXG5cdFx0cHJldjogICAgIG51bGwsIC8vIFNlbGVjdG9yIG9yIERPTSBlbGVtZW50IGZvciBcInByZXZpb3VzIGl0ZW1cIiBidXR0b24uXG5cdFx0bmV4dDogICAgIG51bGwsIC8vIFNlbGVjdG9yIG9yIERPTSBlbGVtZW50IGZvciBcIm5leHQgaXRlbVwiIGJ1dHRvbi5cblx0XHRwcmV2UGFnZTogbnVsbCwgLy8gU2VsZWN0b3Igb3IgRE9NIGVsZW1lbnQgZm9yIFwicHJldmlvdXMgcGFnZVwiIGJ1dHRvbi5cblx0XHRuZXh0UGFnZTogbnVsbCwgLy8gU2VsZWN0b3Igb3IgRE9NIGVsZW1lbnQgZm9yIFwibmV4dCBwYWdlXCIgYnV0dG9uLlxuXG5cdFx0Ly8gQXV0b21hdGVkIGN5Y2xpbmdcblx0XHRjeWNsZUJ5OiAgICAgICBudWxsLCAgLy8gRW5hYmxlIGF1dG9tYXRpYyBjeWNsaW5nIGJ5ICdpdGVtcycgb3IgJ3BhZ2VzJy5cblx0XHRjeWNsZUludGVydmFsOiA1MDAwLCAgLy8gRGVsYXkgYmV0d2VlbiBjeWNsZXMgaW4gbWlsbGlzZWNvbmRzLlxuXHRcdHBhdXNlT25Ib3ZlcjogIGZhbHNlLCAvLyBQYXVzZSBjeWNsaW5nIHdoZW4gbW91c2UgaG92ZXJzIG92ZXIgdGhlIEZSQU1FLlxuXHRcdHN0YXJ0UGF1c2VkOiAgIGZhbHNlLCAvLyBXaGV0aGVyIHRvIHN0YXJ0IGluIHBhdXNlZCBzYXRlLlxuXG5cdFx0Ly8gTWl4ZWQgb3B0aW9uc1xuXHRcdG1vdmVCeTogICAgICAgIDMwMCwgICAgIC8vIFNwZWVkIGluIHBpeGVscyBwZXIgc2Vjb25kIHVzZWQgYnkgZm9yd2FyZCBhbmQgYmFja3dhcmQgYnV0dG9ucy5cblx0XHRzcGVlZDogICAgICAgICAwLCAgICAgICAvLyBBbmltYXRpb25zIHNwZWVkIGluIG1pbGxpc2Vjb25kcy4gMCB0byBkaXNhYmxlIGFuaW1hdGlvbnMuXG5cdFx0ZWFzaW5nOiAgICAgICAgJ3N3aW5nJywgLy8gRWFzaW5nIGZvciBkdXJhdGlvbiBiYXNlZCAodHdlZW5pbmcpIGFuaW1hdGlvbnMuXG5cdFx0c3RhcnRBdDogICAgICAgbnVsbCwgICAgLy8gU3RhcnRpbmcgb2Zmc2V0IGluIHBpeGVscyBvciBpdGVtcy5cblx0XHRrZXlib2FyZE5hdkJ5OiBudWxsLCAgICAvLyBFbmFibGUga2V5Ym9hcmQgbmF2aWdhdGlvbiBieSAnaXRlbXMnIG9yICdwYWdlcycuXG5cblx0XHQvLyBDbGFzc2VzXG5cdFx0ZHJhZ2dlZENsYXNzOiAgJ2RyYWdnZWQnLCAvLyBDbGFzcyBmb3IgZHJhZ2dlZCBlbGVtZW50cyAobGlrZSBTTElERUUgb3Igc2Nyb2xsYmFyIGhhbmRsZSkuXG5cdFx0YWN0aXZlQ2xhc3M6ICAgJ2FjdGl2ZScsICAvLyBDbGFzcyBmb3IgYWN0aXZlIGl0ZW1zIGFuZCBwYWdlcy5cblx0XHRkaXNhYmxlZENsYXNzOiAnZGlzYWJsZWQnIC8vIENsYXNzIGZvciBkaXNhYmxlZCBuYXZpZ2F0aW9uIGVsZW1lbnRzLlxuXHR9O1xufShqUXVlcnksIHdpbmRvdykpO1xuIl0sImZpbGUiOiJzbHkuanMifQ==
