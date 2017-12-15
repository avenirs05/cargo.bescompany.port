/*!
 * Lightbox v2.9.0
 * by Lokesh Dhakar
 *
 * More info:
 * http://lokeshdhakar.com/projects/lightbox2/
 *
 * Copyright 2007, 2015 Lokesh Dhakar
 * Released under the MIT license
 * https://github.com/lokesh/lightbox2/blob/master/LICENSE
 */

// Uses Node, AMD or browser globals to create a module.
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['jquery'], factory);
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory(require('jquery'));
    } else {
        // Browser globals (root is window)
        root.lightbox = factory(root.jQuery);
    }
}(this, function ($) {

  function Lightbox(options) {
    this.album = [];
    this.currentImageIndex = void 0;
    this.init();

    // options
    this.options = $.extend({}, this.constructor.defaults);
    this.option(options);
  }

  // Descriptions of all options available on the demo site:
  // http://lokeshdhakar.com/projects/lightbox2/index.html#options
  Lightbox.defaults = {
    albumLabel: 'Изображение %1 из %2',
    alwaysShowNavOnTouchDevices: false,
    fadeDuration: 600,
    fitImagesInViewport: true,
    imageFadeDuration: 600,
    // maxWidth: 800,
    // maxHeight: 600,
    positionFromTop: 50,
    resizeDuration: 700,
    showImageNumberLabel: true,
    wrapAround: false,
    disableScrolling: false,
    /*
    Sanitize Title
    If the caption data is trusted, for example you are hardcoding it in, then leave this to false.
    This will free you to add html tags, such as links, in the caption.

    If the caption data is user submitted or from some other untrusted source, then set this to true
    to prevent xss and other injection attacks.
     */
    sanitizeTitle: false
  };

  Lightbox.prototype.option = function(options) {
    $.extend(this.options, options);
  };

  Lightbox.prototype.imageCountLabel = function(currentImageNum, totalImages) {
    return this.options.albumLabel.replace(/%1/g, currentImageNum).replace(/%2/g, totalImages);
  };

  Lightbox.prototype.init = function() {
    var self = this;
    // Both enable and build methods require the body tag to be in the DOM.
    $(document).ready(function() {
      self.enable();
      self.build();
    });
  };

  // Loop through anchors and areamaps looking for either data-lightbox attributes or rel attributes
  // that contain 'lightbox'. When these are clicked, start lightbox.
  Lightbox.prototype.enable = function() {
    var self = this;
    $('body').on('click', 'a[rel^=lightbox], area[rel^=lightbox], a[data-lightbox], area[data-lightbox]', function(event) {
      self.start($(event.currentTarget));
      return false;
    });
  };

  // Build html for the lightbox and the overlay.
  // Attach event handlers to the new DOM elements. click click click
  Lightbox.prototype.build = function() {
    var self = this;
      $('<div id="lightboxOverlay" class="lightboxOverlay"></div><div id="lightbox" class="lightbox"><div class="lb-dataContainer"><div class="lb-data"><div class="lb-details"><span class="lb-caption"></span><span class="lb-number"></span></div><div class="lb-closeContainer"><a class="lb-close"></a></div></div></div><div class="lb-outerContainer"><div class="lb-container"><img class="lb-image" src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==" /><div class="lb-nav"><a class="lb-prev" href="" ></a><a class="lb-next" href="" ></a></div><div class="lb-loader"><a class="lb-cancel"></a></div></div></div></div>').appendTo($('body'));

    // Cache jQuery objects
    this.$lightbox       = $('#lightbox');
    this.$overlay        = $('#lightboxOverlay');
    this.$outerContainer = this.$lightbox.find('.lb-outerContainer');
    this.$container      = this.$lightbox.find('.lb-container');
    this.$image          = this.$lightbox.find('.lb-image');
    this.$nav            = this.$lightbox.find('.lb-nav');

    // Store css values for future lookup
    this.containerPadding = {
      top: parseInt(this.$container.css('padding-top'), 10),
      right: parseInt(this.$container.css('padding-right'), 10),
      bottom: parseInt(this.$container.css('padding-bottom'), 10),
      left: parseInt(this.$container.css('padding-left'), 10)
    };

    this.imageBorderWidth = {
      top: parseInt(this.$image.css('border-top-width'), 10),
      right: parseInt(this.$image.css('border-right-width'), 10),
      bottom: parseInt(this.$image.css('border-bottom-width'), 10),
      left: parseInt(this.$image.css('border-left-width'), 10)
    };

    // Attach event handlers to the newly minted DOM elements
    this.$overlay.hide().on('click', function() {
      self.end();
      return false;
    });

    this.$lightbox.hide().on('click', function(event) {
      if ($(event.target).attr('id') === 'lightbox') {
        self.end();
      }
      return false;
    });

    this.$outerContainer.on('click', function(event) {
      if ($(event.target).attr('id') === 'lightbox') {
        self.end();
      }
      return false;
    });

    this.$lightbox.find('.lb-prev').on('click', function() {
      if (self.currentImageIndex === 0) {
        self.changeImage(self.album.length - 1);
      } else {
        self.changeImage(self.currentImageIndex - 1);
      }
      return false;
    });

    this.$lightbox.find('.lb-next').on('click', function() {
      if (self.currentImageIndex === self.album.length - 1) {
        self.changeImage(0);
      } else {
        self.changeImage(self.currentImageIndex + 1);
      }
      return false;
    });

    /*
      Show context menu for image on right-click

      There is a div containing the navigation that spans the entire image and lives above of it. If
      you right-click, you are right clicking this div and not the image. This prevents users from
      saving the image or using other context menu actions with the image.

      To fix this, when we detect the right mouse button is pressed down, but not yet clicked, we
      set pointer-events to none on the nav div. This is so that the upcoming right-click event on
      the next mouseup will bubble down to the image. Once the right-click/contextmenu event occurs
      we set the pointer events back to auto for the nav div so it can capture hover and left-click
      events as usual.
     */
    this.$nav.on('mousedown', function(event) {
      if (event.which === 3) {
        self.$nav.css('pointer-events', 'none');

        self.$lightbox.one('contextmenu', function() {
          setTimeout(function() {
              this.$nav.css('pointer-events', 'auto');
          }.bind(self), 0);
        });
      }
    });


    this.$lightbox.find('.lb-loader, .lb-close').on('click', function() {
      self.end();
      return false;
    });
  };

  // Show overlay and lightbox. If the image is part of a set, add siblings to album array.
  Lightbox.prototype.start = function($link) {
    var self    = this;
    var $window = $(window);

    $window.on('resize', $.proxy(this.sizeOverlay, this));

    $('select, object, embed').css({
      visibility: 'hidden'
    });

    this.sizeOverlay();

    this.album = [];
    var imageNumber = 0;

    function addToAlbum($link) {
      self.album.push({
        link: $link.attr('href'),
        title: $link.attr('data-title') || $link.attr('title')
      });
    }

    // Support both data-lightbox attribute and rel attribute implementations
    var dataLightboxValue = $link.attr('data-lightbox');
    var $links;

    if (dataLightboxValue) {
      $links = $($link.prop('tagName') + '[data-lightbox="' + dataLightboxValue + '"]');
      for (var i = 0; i < $links.length; i = ++i) {
        addToAlbum($($links[i]));
        if ($links[i] === $link[0]) {
          imageNumber = i;
        }
      }
    } else {
      if ($link.attr('rel') === 'lightbox') {
        // If image is not part of a set
        addToAlbum($link);
      } else {
        // If image is part of a set
        $links = $($link.prop('tagName') + '[rel="' + $link.attr('rel') + '"]');
        for (var j = 0; j < $links.length; j = ++j) {
          addToAlbum($($links[j]));
          if ($links[j] === $link[0]) {
            imageNumber = j;
          }
        }
      }
    }

    // Position Lightbox
    var top  = $window.scrollTop() + this.options.positionFromTop;
    var left = $window.scrollLeft();
    this.$lightbox.css({
      top: top + 'px',
      left: left + 'px'
    }).fadeIn(this.options.fadeDuration);

    // Disable scrolling of the page while open
    if (this.options.disableScrolling) {
      $('body').addClass('lb-disable-scrolling');
    }

    this.changeImage(imageNumber);
  };

  // Hide most UI elements in preparation for the animated resizing of the lightbox.
  Lightbox.prototype.changeImage = function(imageNumber) {
    var self = this;

    this.disableKeyboardNav();
    var $image = this.$lightbox.find('.lb-image');

    this.$overlay.fadeIn(this.options.fadeDuration);

    $('.lb-loader').fadeIn('slow');
    this.$lightbox.find('.lb-image, .lb-nav, .lb-prev, .lb-next, .lb-dataContainer, .lb-numbers, .lb-caption').hide();

    this.$outerContainer.addClass('animating');

    // When image to show is preloaded, we send the width and height to sizeContainer()
    var preloader = new Image();
    preloader.onload = function() {
      var $preloader;
      var imageHeight;
      var imageWidth;
      var maxImageHeight;
      var maxImageWidth;
      var windowHeight;
      var windowWidth;

      $image.attr('src', self.album[imageNumber].link);

      $preloader = $(preloader);

      $image.width(preloader.width);
      $image.height(preloader.height);

      if (self.options.fitImagesInViewport) {
        // Fit image inside the viewport.
        // Take into account the border around the image and an additional 10px gutter on each side.

        windowWidth    = $(window).width();
        windowHeight   = $(window).height();
        maxImageWidth  = windowWidth - self.containerPadding.left - self.containerPadding.right - self.imageBorderWidth.left - self.imageBorderWidth.right - 20;
        maxImageHeight = windowHeight - self.containerPadding.top - self.containerPadding.bottom - self.imageBorderWidth.top - self.imageBorderWidth.bottom - 120;

        // Check if image size is larger then maxWidth|maxHeight in settings
        if (self.options.maxWidth && self.options.maxWidth < maxImageWidth) {
          maxImageWidth = self.options.maxWidth;
        }
        if (self.options.maxHeight && self.options.maxHeight < maxImageWidth) {
          maxImageHeight = self.options.maxHeight;
        }

        // Is there a fitting issue?
        if ((preloader.width > maxImageWidth) || (preloader.height > maxImageHeight)) {
          if ((preloader.width / maxImageWidth) > (preloader.height / maxImageHeight)) {
            imageWidth  = maxImageWidth;
            imageHeight = parseInt(preloader.height / (preloader.width / imageWidth), 10);
            $image.width(imageWidth);
            $image.height(imageHeight);
          } else {
            imageHeight = maxImageHeight;
            imageWidth = parseInt(preloader.width / (preloader.height / imageHeight), 10);
            $image.width(imageWidth);
            $image.height(imageHeight);
          }
        }
      }
      self.sizeContainer($image.width(), $image.height());
    };

    preloader.src          = this.album[imageNumber].link;
    this.currentImageIndex = imageNumber;
  };

  // Stretch overlay to fit the viewport
  Lightbox.prototype.sizeOverlay = function() {
    this.$overlay
      .width($(document).width())
      .height($(document).height());
  };

  // Animate the size of the lightbox to fit the image we are showing
  Lightbox.prototype.sizeContainer = function(imageWidth, imageHeight) {
    var self = this;

    var oldWidth  = this.$outerContainer.outerWidth();
    var oldHeight = this.$outerContainer.outerHeight();
    var newWidth  = imageWidth + this.containerPadding.left + this.containerPadding.right + this.imageBorderWidth.left + this.imageBorderWidth.right;
    var newHeight = imageHeight + this.containerPadding.top + this.containerPadding.bottom + this.imageBorderWidth.top + this.imageBorderWidth.bottom;

    function postResize() {
      self.$lightbox.find('.lb-dataContainer').width(newWidth);
      self.$lightbox.find('.lb-prevLink').height(newHeight);
      self.$lightbox.find('.lb-nextLink').height(newHeight);
      self.showImage();
    }

    if (oldWidth !== newWidth || oldHeight !== newHeight) {
      this.$outerContainer.animate({
        width: newWidth,
        height: newHeight
      }, this.options.resizeDuration, 'swing', function() {
        postResize();
      });
    } else {
      postResize();
    }
  };

  // Display the image and its details and begin preload neighboring images.
  Lightbox.prototype.showImage = function() {
    this.$lightbox.find('.lb-loader').stop(true).hide();
    this.$lightbox.find('.lb-image').fadeIn(this.options.imageFadeDuration);

    this.updateNav();
    this.updateDetails();
    this.preloadNeighboringImages();
    this.enableKeyboardNav();
  };

  // Display previous and next navigation if appropriate.
  Lightbox.prototype.updateNav = function() {
    // Check to see if the browser supports touch events. If so, we take the conservative approach
    // and assume that mouse hover events are not supported and always show prev/next navigation
    // arrows in image sets.
    var alwaysShowNav = false;
    try {
      document.createEvent('TouchEvent');
      alwaysShowNav = (this.options.alwaysShowNavOnTouchDevices) ? true : false;
    } catch (e) {}

    this.$lightbox.find('.lb-nav').show();

    if (this.album.length > 1) {
      if (this.options.wrapAround) {
        if (alwaysShowNav) {
          this.$lightbox.find('.lb-prev, .lb-next').css('opacity', '1');
        }
        this.$lightbox.find('.lb-prev, .lb-next').show();
      } else {
        if (this.currentImageIndex > 0) {
          this.$lightbox.find('.lb-prev').show();
          if (alwaysShowNav) {
            this.$lightbox.find('.lb-prev').css('opacity', '1');
          }
        }
        if (this.currentImageIndex < this.album.length - 1) {
          this.$lightbox.find('.lb-next').show();
          if (alwaysShowNav) {
            this.$lightbox.find('.lb-next').css('opacity', '1');
          }
        }
      }
    }
  };

  // Display caption, image number, and closing button.
  Lightbox.prototype.updateDetails = function() {
    var self = this;

    // Enable anchor clicks in the injected caption html.
    // Thanks Nate Wright for the fix. @https://github.com/NateWr
    if (typeof this.album[this.currentImageIndex].title !== 'undefined' &&
      this.album[this.currentImageIndex].title !== '') {
      var $caption = this.$lightbox.find('.lb-caption');
      if (this.options.sanitizeTitle) {
        $caption.text(this.album[this.currentImageIndex].title);
      } else {
        $caption.html(this.album[this.currentImageIndex].title);
      }
      $caption.fadeIn('fast')
        .find('a').on('click', function(event) {
          if ($(this).attr('target') !== undefined) {
            window.open($(this).attr('href'), $(this).attr('target'));
          } else {
            location.href = $(this).attr('href');
          }
        });
    }

    if (this.album.length > 1 && this.options.showImageNumberLabel) {
      var labelText = this.imageCountLabel(this.currentImageIndex + 1, this.album.length);
      this.$lightbox.find('.lb-number').text(labelText).fadeIn('fast');
    } else {
      this.$lightbox.find('.lb-number').hide();
    }

    this.$outerContainer.removeClass('animating');

    this.$lightbox.find('.lb-dataContainer').fadeIn(this.options.resizeDuration, function() {
      return self.sizeOverlay();
    });
  };

  // Preload previous and next images in set.
  Lightbox.prototype.preloadNeighboringImages = function() {
    if (this.album.length > this.currentImageIndex + 1) {
      var preloadNext = new Image();
      preloadNext.src = this.album[this.currentImageIndex + 1].link;
    }
    if (this.currentImageIndex > 0) {
      var preloadPrev = new Image();
      preloadPrev.src = this.album[this.currentImageIndex - 1].link;
    }
  };

  Lightbox.prototype.enableKeyboardNav = function() {
    $(document).on('keyup.keyboard', $.proxy(this.keyboardAction, this));
  };

  Lightbox.prototype.disableKeyboardNav = function() {
    $(document).off('.keyboard');
  };

  Lightbox.prototype.keyboardAction = function(event) {
    var KEYCODE_ESC        = 27;
    var KEYCODE_LEFTARROW  = 37;
    var KEYCODE_RIGHTARROW = 39;

    var keycode = event.keyCode;
    var key     = String.fromCharCode(keycode).toLowerCase();
    if (keycode === KEYCODE_ESC || key.match(/x|o|c/)) {
      this.end();
    } else if (key === 'p' || keycode === KEYCODE_LEFTARROW) {
      if (this.currentImageIndex !== 0) {
        this.changeImage(this.currentImageIndex - 1);
      } else if (this.options.wrapAround && this.album.length > 1) {
        this.changeImage(this.album.length - 1);
      }
    } else if (key === 'n' || keycode === KEYCODE_RIGHTARROW) {
      if (this.currentImageIndex !== this.album.length - 1) {
        this.changeImage(this.currentImageIndex + 1);
      } else if (this.options.wrapAround && this.album.length > 1) {
        this.changeImage(0);
      }
    }
  };

  // Closing time. :-(
  Lightbox.prototype.end = function() {
    this.disableKeyboardNav();
    $(window).off('resize', this.sizeOverlay);
    this.$lightbox.fadeOut(this.options.fadeDuration);
    this.$overlay.fadeOut(this.options.fadeDuration);
    $('select, object, embed').css({
      visibility: 'visible'
    });
    if (this.options.disableScrolling) {
      $('body').removeClass('lb-disable-scrolling');
    }
  };

  return new Lightbox();
}));

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJsaWdodGJveC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiFcbiAqIExpZ2h0Ym94IHYyLjkuMFxuICogYnkgTG9rZXNoIERoYWthclxuICpcbiAqIE1vcmUgaW5mbzpcbiAqIGh0dHA6Ly9sb2tlc2hkaGFrYXIuY29tL3Byb2plY3RzL2xpZ2h0Ym94Mi9cbiAqXG4gKiBDb3B5cmlnaHQgMjAwNywgMjAxNSBMb2tlc2ggRGhha2FyXG4gKiBSZWxlYXNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2VcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9sb2tlc2gvbGlnaHRib3gyL2Jsb2IvbWFzdGVyL0xJQ0VOU0VcbiAqL1xuXG4vLyBVc2VzIE5vZGUsIEFNRCBvciBicm93c2VyIGdsb2JhbHMgdG8gY3JlYXRlIGEgbW9kdWxlLlxuKGZ1bmN0aW9uIChyb290LCBmYWN0b3J5KSB7XG4gICAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgICAgICAvLyBBTUQuIFJlZ2lzdGVyIGFzIGFuIGFub255bW91cyBtb2R1bGUuXG4gICAgICAgIGRlZmluZShbJ2pxdWVyeSddLCBmYWN0b3J5KTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xuICAgICAgICAvLyBOb2RlLiBEb2VzIG5vdCB3b3JrIHdpdGggc3RyaWN0IENvbW1vbkpTLCBidXRcbiAgICAgICAgLy8gb25seSBDb21tb25KUy1saWtlIGVudmlyb25tZW50cyB0aGF0IHN1cHBvcnQgbW9kdWxlLmV4cG9ydHMsXG4gICAgICAgIC8vIGxpa2UgTm9kZS5cbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KHJlcXVpcmUoJ2pxdWVyeScpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyBCcm93c2VyIGdsb2JhbHMgKHJvb3QgaXMgd2luZG93KVxuICAgICAgICByb290LmxpZ2h0Ym94ID0gZmFjdG9yeShyb290LmpRdWVyeSk7XG4gICAgfVxufSh0aGlzLCBmdW5jdGlvbiAoJCkge1xuXG4gIGZ1bmN0aW9uIExpZ2h0Ym94KG9wdGlvbnMpIHtcbiAgICB0aGlzLmFsYnVtID0gW107XG4gICAgdGhpcy5jdXJyZW50SW1hZ2VJbmRleCA9IHZvaWQgMDtcbiAgICB0aGlzLmluaXQoKTtcblxuICAgIC8vIG9wdGlvbnNcbiAgICB0aGlzLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgdGhpcy5jb25zdHJ1Y3Rvci5kZWZhdWx0cyk7XG4gICAgdGhpcy5vcHRpb24ob3B0aW9ucyk7XG4gIH1cblxuICAvLyBEZXNjcmlwdGlvbnMgb2YgYWxsIG9wdGlvbnMgYXZhaWxhYmxlIG9uIHRoZSBkZW1vIHNpdGU6XG4gIC8vIGh0dHA6Ly9sb2tlc2hkaGFrYXIuY29tL3Byb2plY3RzL2xpZ2h0Ym94Mi9pbmRleC5odG1sI29wdGlvbnNcbiAgTGlnaHRib3guZGVmYXVsdHMgPSB7XG4gICAgYWxidW1MYWJlbDogJ9CY0LfQvtCx0YDQsNC20LXQvdC40LUgJTEg0LjQtyAlMicsXG4gICAgYWx3YXlzU2hvd05hdk9uVG91Y2hEZXZpY2VzOiBmYWxzZSxcbiAgICBmYWRlRHVyYXRpb246IDYwMCxcbiAgICBmaXRJbWFnZXNJblZpZXdwb3J0OiB0cnVlLFxuICAgIGltYWdlRmFkZUR1cmF0aW9uOiA2MDAsXG4gICAgLy8gbWF4V2lkdGg6IDgwMCxcbiAgICAvLyBtYXhIZWlnaHQ6IDYwMCxcbiAgICBwb3NpdGlvbkZyb21Ub3A6IDUwLFxuICAgIHJlc2l6ZUR1cmF0aW9uOiA3MDAsXG4gICAgc2hvd0ltYWdlTnVtYmVyTGFiZWw6IHRydWUsXG4gICAgd3JhcEFyb3VuZDogZmFsc2UsXG4gICAgZGlzYWJsZVNjcm9sbGluZzogZmFsc2UsXG4gICAgLypcbiAgICBTYW5pdGl6ZSBUaXRsZVxuICAgIElmIHRoZSBjYXB0aW9uIGRhdGEgaXMgdHJ1c3RlZCwgZm9yIGV4YW1wbGUgeW91IGFyZSBoYXJkY29kaW5nIGl0IGluLCB0aGVuIGxlYXZlIHRoaXMgdG8gZmFsc2UuXG4gICAgVGhpcyB3aWxsIGZyZWUgeW91IHRvIGFkZCBodG1sIHRhZ3MsIHN1Y2ggYXMgbGlua3MsIGluIHRoZSBjYXB0aW9uLlxuXG4gICAgSWYgdGhlIGNhcHRpb24gZGF0YSBpcyB1c2VyIHN1Ym1pdHRlZCBvciBmcm9tIHNvbWUgb3RoZXIgdW50cnVzdGVkIHNvdXJjZSwgdGhlbiBzZXQgdGhpcyB0byB0cnVlXG4gICAgdG8gcHJldmVudCB4c3MgYW5kIG90aGVyIGluamVjdGlvbiBhdHRhY2tzLlxuICAgICAqL1xuICAgIHNhbml0aXplVGl0bGU6IGZhbHNlXG4gIH07XG5cbiAgTGlnaHRib3gucHJvdG90eXBlLm9wdGlvbiA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAkLmV4dGVuZCh0aGlzLm9wdGlvbnMsIG9wdGlvbnMpO1xuICB9O1xuXG4gIExpZ2h0Ym94LnByb3RvdHlwZS5pbWFnZUNvdW50TGFiZWwgPSBmdW5jdGlvbihjdXJyZW50SW1hZ2VOdW0sIHRvdGFsSW1hZ2VzKSB7XG4gICAgcmV0dXJuIHRoaXMub3B0aW9ucy5hbGJ1bUxhYmVsLnJlcGxhY2UoLyUxL2csIGN1cnJlbnRJbWFnZU51bSkucmVwbGFjZSgvJTIvZywgdG90YWxJbWFnZXMpO1xuICB9O1xuXG4gIExpZ2h0Ym94LnByb3RvdHlwZS5pbml0ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIC8vIEJvdGggZW5hYmxlIGFuZCBidWlsZCBtZXRob2RzIHJlcXVpcmUgdGhlIGJvZHkgdGFnIHRvIGJlIGluIHRoZSBET00uXG4gICAgJChkb2N1bWVudCkucmVhZHkoZnVuY3Rpb24oKSB7XG4gICAgICBzZWxmLmVuYWJsZSgpO1xuICAgICAgc2VsZi5idWlsZCgpO1xuICAgIH0pO1xuICB9O1xuXG4gIC8vIExvb3AgdGhyb3VnaCBhbmNob3JzIGFuZCBhcmVhbWFwcyBsb29raW5nIGZvciBlaXRoZXIgZGF0YS1saWdodGJveCBhdHRyaWJ1dGVzIG9yIHJlbCBhdHRyaWJ1dGVzXG4gIC8vIHRoYXQgY29udGFpbiAnbGlnaHRib3gnLiBXaGVuIHRoZXNlIGFyZSBjbGlja2VkLCBzdGFydCBsaWdodGJveC5cbiAgTGlnaHRib3gucHJvdG90eXBlLmVuYWJsZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAkKCdib2R5Jykub24oJ2NsaWNrJywgJ2FbcmVsXj1saWdodGJveF0sIGFyZWFbcmVsXj1saWdodGJveF0sIGFbZGF0YS1saWdodGJveF0sIGFyZWFbZGF0YS1saWdodGJveF0nLCBmdW5jdGlvbihldmVudCkge1xuICAgICAgc2VsZi5zdGFydCgkKGV2ZW50LmN1cnJlbnRUYXJnZXQpKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9KTtcbiAgfTtcblxuICAvLyBCdWlsZCBodG1sIGZvciB0aGUgbGlnaHRib3ggYW5kIHRoZSBvdmVybGF5LlxuICAvLyBBdHRhY2ggZXZlbnQgaGFuZGxlcnMgdG8gdGhlIG5ldyBET00gZWxlbWVudHMuIGNsaWNrIGNsaWNrIGNsaWNrXG4gIExpZ2h0Ym94LnByb3RvdHlwZS5idWlsZCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICQoJzxkaXYgaWQ9XCJsaWdodGJveE92ZXJsYXlcIiBjbGFzcz1cImxpZ2h0Ym94T3ZlcmxheVwiPjwvZGl2PjxkaXYgaWQ9XCJsaWdodGJveFwiIGNsYXNzPVwibGlnaHRib3hcIj48ZGl2IGNsYXNzPVwibGItZGF0YUNvbnRhaW5lclwiPjxkaXYgY2xhc3M9XCJsYi1kYXRhXCI+PGRpdiBjbGFzcz1cImxiLWRldGFpbHNcIj48c3BhbiBjbGFzcz1cImxiLWNhcHRpb25cIj48L3NwYW4+PHNwYW4gY2xhc3M9XCJsYi1udW1iZXJcIj48L3NwYW4+PC9kaXY+PGRpdiBjbGFzcz1cImxiLWNsb3NlQ29udGFpbmVyXCI+PGEgY2xhc3M9XCJsYi1jbG9zZVwiPjwvYT48L2Rpdj48L2Rpdj48L2Rpdj48ZGl2IGNsYXNzPVwibGItb3V0ZXJDb250YWluZXJcIj48ZGl2IGNsYXNzPVwibGItY29udGFpbmVyXCI+PGltZyBjbGFzcz1cImxiLWltYWdlXCIgc3JjPVwiZGF0YTppbWFnZS9naWY7YmFzZTY0LFIwbEdPRGxoQVFBQkFJQUFBUC8vL3dBQUFDSDVCQUVBQUFBQUxBQUFBQUFCQUFFQUFBSUNSQUVBT3c9PVwiIC8+PGRpdiBjbGFzcz1cImxiLW5hdlwiPjxhIGNsYXNzPVwibGItcHJldlwiIGhyZWY9XCJcIiA+PC9hPjxhIGNsYXNzPVwibGItbmV4dFwiIGhyZWY9XCJcIiA+PC9hPjwvZGl2PjxkaXYgY2xhc3M9XCJsYi1sb2FkZXJcIj48YSBjbGFzcz1cImxiLWNhbmNlbFwiPjwvYT48L2Rpdj48L2Rpdj48L2Rpdj48L2Rpdj4nKS5hcHBlbmRUbygkKCdib2R5JykpO1xuXG4gICAgLy8gQ2FjaGUgalF1ZXJ5IG9iamVjdHNcbiAgICB0aGlzLiRsaWdodGJveCAgICAgICA9ICQoJyNsaWdodGJveCcpO1xuICAgIHRoaXMuJG92ZXJsYXkgICAgICAgID0gJCgnI2xpZ2h0Ym94T3ZlcmxheScpO1xuICAgIHRoaXMuJG91dGVyQ29udGFpbmVyID0gdGhpcy4kbGlnaHRib3guZmluZCgnLmxiLW91dGVyQ29udGFpbmVyJyk7XG4gICAgdGhpcy4kY29udGFpbmVyICAgICAgPSB0aGlzLiRsaWdodGJveC5maW5kKCcubGItY29udGFpbmVyJyk7XG4gICAgdGhpcy4kaW1hZ2UgICAgICAgICAgPSB0aGlzLiRsaWdodGJveC5maW5kKCcubGItaW1hZ2UnKTtcbiAgICB0aGlzLiRuYXYgICAgICAgICAgICA9IHRoaXMuJGxpZ2h0Ym94LmZpbmQoJy5sYi1uYXYnKTtcblxuICAgIC8vIFN0b3JlIGNzcyB2YWx1ZXMgZm9yIGZ1dHVyZSBsb29rdXBcbiAgICB0aGlzLmNvbnRhaW5lclBhZGRpbmcgPSB7XG4gICAgICB0b3A6IHBhcnNlSW50KHRoaXMuJGNvbnRhaW5lci5jc3MoJ3BhZGRpbmctdG9wJyksIDEwKSxcbiAgICAgIHJpZ2h0OiBwYXJzZUludCh0aGlzLiRjb250YWluZXIuY3NzKCdwYWRkaW5nLXJpZ2h0JyksIDEwKSxcbiAgICAgIGJvdHRvbTogcGFyc2VJbnQodGhpcy4kY29udGFpbmVyLmNzcygncGFkZGluZy1ib3R0b20nKSwgMTApLFxuICAgICAgbGVmdDogcGFyc2VJbnQodGhpcy4kY29udGFpbmVyLmNzcygncGFkZGluZy1sZWZ0JyksIDEwKVxuICAgIH07XG5cbiAgICB0aGlzLmltYWdlQm9yZGVyV2lkdGggPSB7XG4gICAgICB0b3A6IHBhcnNlSW50KHRoaXMuJGltYWdlLmNzcygnYm9yZGVyLXRvcC13aWR0aCcpLCAxMCksXG4gICAgICByaWdodDogcGFyc2VJbnQodGhpcy4kaW1hZ2UuY3NzKCdib3JkZXItcmlnaHQtd2lkdGgnKSwgMTApLFxuICAgICAgYm90dG9tOiBwYXJzZUludCh0aGlzLiRpbWFnZS5jc3MoJ2JvcmRlci1ib3R0b20td2lkdGgnKSwgMTApLFxuICAgICAgbGVmdDogcGFyc2VJbnQodGhpcy4kaW1hZ2UuY3NzKCdib3JkZXItbGVmdC13aWR0aCcpLCAxMClcbiAgICB9O1xuXG4gICAgLy8gQXR0YWNoIGV2ZW50IGhhbmRsZXJzIHRvIHRoZSBuZXdseSBtaW50ZWQgRE9NIGVsZW1lbnRzXG4gICAgdGhpcy4kb3ZlcmxheS5oaWRlKCkub24oJ2NsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICBzZWxmLmVuZCgpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0pO1xuXG4gICAgdGhpcy4kbGlnaHRib3guaGlkZSgpLm9uKCdjbGljaycsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICBpZiAoJChldmVudC50YXJnZXQpLmF0dHIoJ2lkJykgPT09ICdsaWdodGJveCcpIHtcbiAgICAgICAgc2VsZi5lbmQoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9KTtcblxuICAgIHRoaXMuJG91dGVyQ29udGFpbmVyLm9uKCdjbGljaycsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICBpZiAoJChldmVudC50YXJnZXQpLmF0dHIoJ2lkJykgPT09ICdsaWdodGJveCcpIHtcbiAgICAgICAgc2VsZi5lbmQoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9KTtcblxuICAgIHRoaXMuJGxpZ2h0Ym94LmZpbmQoJy5sYi1wcmV2Jykub24oJ2NsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoc2VsZi5jdXJyZW50SW1hZ2VJbmRleCA9PT0gMCkge1xuICAgICAgICBzZWxmLmNoYW5nZUltYWdlKHNlbGYuYWxidW0ubGVuZ3RoIC0gMSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZWxmLmNoYW5nZUltYWdlKHNlbGYuY3VycmVudEltYWdlSW5kZXggLSAxKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9KTtcblxuICAgIHRoaXMuJGxpZ2h0Ym94LmZpbmQoJy5sYi1uZXh0Jykub24oJ2NsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoc2VsZi5jdXJyZW50SW1hZ2VJbmRleCA9PT0gc2VsZi5hbGJ1bS5sZW5ndGggLSAxKSB7XG4gICAgICAgIHNlbGYuY2hhbmdlSW1hZ2UoMCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZWxmLmNoYW5nZUltYWdlKHNlbGYuY3VycmVudEltYWdlSW5kZXggKyAxKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9KTtcblxuICAgIC8qXG4gICAgICBTaG93IGNvbnRleHQgbWVudSBmb3IgaW1hZ2Ugb24gcmlnaHQtY2xpY2tcblxuICAgICAgVGhlcmUgaXMgYSBkaXYgY29udGFpbmluZyB0aGUgbmF2aWdhdGlvbiB0aGF0IHNwYW5zIHRoZSBlbnRpcmUgaW1hZ2UgYW5kIGxpdmVzIGFib3ZlIG9mIGl0LiBJZlxuICAgICAgeW91IHJpZ2h0LWNsaWNrLCB5b3UgYXJlIHJpZ2h0IGNsaWNraW5nIHRoaXMgZGl2IGFuZCBub3QgdGhlIGltYWdlLiBUaGlzIHByZXZlbnRzIHVzZXJzIGZyb21cbiAgICAgIHNhdmluZyB0aGUgaW1hZ2Ugb3IgdXNpbmcgb3RoZXIgY29udGV4dCBtZW51IGFjdGlvbnMgd2l0aCB0aGUgaW1hZ2UuXG5cbiAgICAgIFRvIGZpeCB0aGlzLCB3aGVuIHdlIGRldGVjdCB0aGUgcmlnaHQgbW91c2UgYnV0dG9uIGlzIHByZXNzZWQgZG93biwgYnV0IG5vdCB5ZXQgY2xpY2tlZCwgd2VcbiAgICAgIHNldCBwb2ludGVyLWV2ZW50cyB0byBub25lIG9uIHRoZSBuYXYgZGl2LiBUaGlzIGlzIHNvIHRoYXQgdGhlIHVwY29taW5nIHJpZ2h0LWNsaWNrIGV2ZW50IG9uXG4gICAgICB0aGUgbmV4dCBtb3VzZXVwIHdpbGwgYnViYmxlIGRvd24gdG8gdGhlIGltYWdlLiBPbmNlIHRoZSByaWdodC1jbGljay9jb250ZXh0bWVudSBldmVudCBvY2N1cnNcbiAgICAgIHdlIHNldCB0aGUgcG9pbnRlciBldmVudHMgYmFjayB0byBhdXRvIGZvciB0aGUgbmF2IGRpdiBzbyBpdCBjYW4gY2FwdHVyZSBob3ZlciBhbmQgbGVmdC1jbGlja1xuICAgICAgZXZlbnRzIGFzIHVzdWFsLlxuICAgICAqL1xuICAgIHRoaXMuJG5hdi5vbignbW91c2Vkb3duJywgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgIGlmIChldmVudC53aGljaCA9PT0gMykge1xuICAgICAgICBzZWxmLiRuYXYuY3NzKCdwb2ludGVyLWV2ZW50cycsICdub25lJyk7XG5cbiAgICAgICAgc2VsZi4kbGlnaHRib3gub25lKCdjb250ZXh0bWVudScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIHRoaXMuJG5hdi5jc3MoJ3BvaW50ZXItZXZlbnRzJywgJ2F1dG8nKTtcbiAgICAgICAgICB9LmJpbmQoc2VsZiksIDApO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcblxuXG4gICAgdGhpcy4kbGlnaHRib3guZmluZCgnLmxiLWxvYWRlciwgLmxiLWNsb3NlJykub24oJ2NsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICBzZWxmLmVuZCgpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0pO1xuICB9O1xuXG4gIC8vIFNob3cgb3ZlcmxheSBhbmQgbGlnaHRib3guIElmIHRoZSBpbWFnZSBpcyBwYXJ0IG9mIGEgc2V0LCBhZGQgc2libGluZ3MgdG8gYWxidW0gYXJyYXkuXG4gIExpZ2h0Ym94LnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKCRsaW5rKSB7XG4gICAgdmFyIHNlbGYgICAgPSB0aGlzO1xuICAgIHZhciAkd2luZG93ID0gJCh3aW5kb3cpO1xuXG4gICAgJHdpbmRvdy5vbigncmVzaXplJywgJC5wcm94eSh0aGlzLnNpemVPdmVybGF5LCB0aGlzKSk7XG5cbiAgICAkKCdzZWxlY3QsIG9iamVjdCwgZW1iZWQnKS5jc3Moe1xuICAgICAgdmlzaWJpbGl0eTogJ2hpZGRlbidcbiAgICB9KTtcblxuICAgIHRoaXMuc2l6ZU92ZXJsYXkoKTtcblxuICAgIHRoaXMuYWxidW0gPSBbXTtcbiAgICB2YXIgaW1hZ2VOdW1iZXIgPSAwO1xuXG4gICAgZnVuY3Rpb24gYWRkVG9BbGJ1bSgkbGluaykge1xuICAgICAgc2VsZi5hbGJ1bS5wdXNoKHtcbiAgICAgICAgbGluazogJGxpbmsuYXR0cignaHJlZicpLFxuICAgICAgICB0aXRsZTogJGxpbmsuYXR0cignZGF0YS10aXRsZScpIHx8ICRsaW5rLmF0dHIoJ3RpdGxlJylcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIFN1cHBvcnQgYm90aCBkYXRhLWxpZ2h0Ym94IGF0dHJpYnV0ZSBhbmQgcmVsIGF0dHJpYnV0ZSBpbXBsZW1lbnRhdGlvbnNcbiAgICB2YXIgZGF0YUxpZ2h0Ym94VmFsdWUgPSAkbGluay5hdHRyKCdkYXRhLWxpZ2h0Ym94Jyk7XG4gICAgdmFyICRsaW5rcztcblxuICAgIGlmIChkYXRhTGlnaHRib3hWYWx1ZSkge1xuICAgICAgJGxpbmtzID0gJCgkbGluay5wcm9wKCd0YWdOYW1lJykgKyAnW2RhdGEtbGlnaHRib3g9XCInICsgZGF0YUxpZ2h0Ym94VmFsdWUgKyAnXCJdJyk7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8ICRsaW5rcy5sZW5ndGg7IGkgPSArK2kpIHtcbiAgICAgICAgYWRkVG9BbGJ1bSgkKCRsaW5rc1tpXSkpO1xuICAgICAgICBpZiAoJGxpbmtzW2ldID09PSAkbGlua1swXSkge1xuICAgICAgICAgIGltYWdlTnVtYmVyID0gaTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoJGxpbmsuYXR0cigncmVsJykgPT09ICdsaWdodGJveCcpIHtcbiAgICAgICAgLy8gSWYgaW1hZ2UgaXMgbm90IHBhcnQgb2YgYSBzZXRcbiAgICAgICAgYWRkVG9BbGJ1bSgkbGluayk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBJZiBpbWFnZSBpcyBwYXJ0IG9mIGEgc2V0XG4gICAgICAgICRsaW5rcyA9ICQoJGxpbmsucHJvcCgndGFnTmFtZScpICsgJ1tyZWw9XCInICsgJGxpbmsuYXR0cigncmVsJykgKyAnXCJdJyk7XG4gICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgJGxpbmtzLmxlbmd0aDsgaiA9ICsraikge1xuICAgICAgICAgIGFkZFRvQWxidW0oJCgkbGlua3Nbal0pKTtcbiAgICAgICAgICBpZiAoJGxpbmtzW2pdID09PSAkbGlua1swXSkge1xuICAgICAgICAgICAgaW1hZ2VOdW1iZXIgPSBqO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFBvc2l0aW9uIExpZ2h0Ym94XG4gICAgdmFyIHRvcCAgPSAkd2luZG93LnNjcm9sbFRvcCgpICsgdGhpcy5vcHRpb25zLnBvc2l0aW9uRnJvbVRvcDtcbiAgICB2YXIgbGVmdCA9ICR3aW5kb3cuc2Nyb2xsTGVmdCgpO1xuICAgIHRoaXMuJGxpZ2h0Ym94LmNzcyh7XG4gICAgICB0b3A6IHRvcCArICdweCcsXG4gICAgICBsZWZ0OiBsZWZ0ICsgJ3B4J1xuICAgIH0pLmZhZGVJbih0aGlzLm9wdGlvbnMuZmFkZUR1cmF0aW9uKTtcblxuICAgIC8vIERpc2FibGUgc2Nyb2xsaW5nIG9mIHRoZSBwYWdlIHdoaWxlIG9wZW5cbiAgICBpZiAodGhpcy5vcHRpb25zLmRpc2FibGVTY3JvbGxpbmcpIHtcbiAgICAgICQoJ2JvZHknKS5hZGRDbGFzcygnbGItZGlzYWJsZS1zY3JvbGxpbmcnKTtcbiAgICB9XG5cbiAgICB0aGlzLmNoYW5nZUltYWdlKGltYWdlTnVtYmVyKTtcbiAgfTtcblxuICAvLyBIaWRlIG1vc3QgVUkgZWxlbWVudHMgaW4gcHJlcGFyYXRpb24gZm9yIHRoZSBhbmltYXRlZCByZXNpemluZyBvZiB0aGUgbGlnaHRib3guXG4gIExpZ2h0Ym94LnByb3RvdHlwZS5jaGFuZ2VJbWFnZSA9IGZ1bmN0aW9uKGltYWdlTnVtYmVyKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdGhpcy5kaXNhYmxlS2V5Ym9hcmROYXYoKTtcbiAgICB2YXIgJGltYWdlID0gdGhpcy4kbGlnaHRib3guZmluZCgnLmxiLWltYWdlJyk7XG5cbiAgICB0aGlzLiRvdmVybGF5LmZhZGVJbih0aGlzLm9wdGlvbnMuZmFkZUR1cmF0aW9uKTtcblxuICAgICQoJy5sYi1sb2FkZXInKS5mYWRlSW4oJ3Nsb3cnKTtcbiAgICB0aGlzLiRsaWdodGJveC5maW5kKCcubGItaW1hZ2UsIC5sYi1uYXYsIC5sYi1wcmV2LCAubGItbmV4dCwgLmxiLWRhdGFDb250YWluZXIsIC5sYi1udW1iZXJzLCAubGItY2FwdGlvbicpLmhpZGUoKTtcblxuICAgIHRoaXMuJG91dGVyQ29udGFpbmVyLmFkZENsYXNzKCdhbmltYXRpbmcnKTtcblxuICAgIC8vIFdoZW4gaW1hZ2UgdG8gc2hvdyBpcyBwcmVsb2FkZWQsIHdlIHNlbmQgdGhlIHdpZHRoIGFuZCBoZWlnaHQgdG8gc2l6ZUNvbnRhaW5lcigpXG4gICAgdmFyIHByZWxvYWRlciA9IG5ldyBJbWFnZSgpO1xuICAgIHByZWxvYWRlci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciAkcHJlbG9hZGVyO1xuICAgICAgdmFyIGltYWdlSGVpZ2h0O1xuICAgICAgdmFyIGltYWdlV2lkdGg7XG4gICAgICB2YXIgbWF4SW1hZ2VIZWlnaHQ7XG4gICAgICB2YXIgbWF4SW1hZ2VXaWR0aDtcbiAgICAgIHZhciB3aW5kb3dIZWlnaHQ7XG4gICAgICB2YXIgd2luZG93V2lkdGg7XG5cbiAgICAgICRpbWFnZS5hdHRyKCdzcmMnLCBzZWxmLmFsYnVtW2ltYWdlTnVtYmVyXS5saW5rKTtcblxuICAgICAgJHByZWxvYWRlciA9ICQocHJlbG9hZGVyKTtcblxuICAgICAgJGltYWdlLndpZHRoKHByZWxvYWRlci53aWR0aCk7XG4gICAgICAkaW1hZ2UuaGVpZ2h0KHByZWxvYWRlci5oZWlnaHQpO1xuXG4gICAgICBpZiAoc2VsZi5vcHRpb25zLmZpdEltYWdlc0luVmlld3BvcnQpIHtcbiAgICAgICAgLy8gRml0IGltYWdlIGluc2lkZSB0aGUgdmlld3BvcnQuXG4gICAgICAgIC8vIFRha2UgaW50byBhY2NvdW50IHRoZSBib3JkZXIgYXJvdW5kIHRoZSBpbWFnZSBhbmQgYW4gYWRkaXRpb25hbCAxMHB4IGd1dHRlciBvbiBlYWNoIHNpZGUuXG5cbiAgICAgICAgd2luZG93V2lkdGggICAgPSAkKHdpbmRvdykud2lkdGgoKTtcbiAgICAgICAgd2luZG93SGVpZ2h0ICAgPSAkKHdpbmRvdykuaGVpZ2h0KCk7XG4gICAgICAgIG1heEltYWdlV2lkdGggID0gd2luZG93V2lkdGggLSBzZWxmLmNvbnRhaW5lclBhZGRpbmcubGVmdCAtIHNlbGYuY29udGFpbmVyUGFkZGluZy5yaWdodCAtIHNlbGYuaW1hZ2VCb3JkZXJXaWR0aC5sZWZ0IC0gc2VsZi5pbWFnZUJvcmRlcldpZHRoLnJpZ2h0IC0gMjA7XG4gICAgICAgIG1heEltYWdlSGVpZ2h0ID0gd2luZG93SGVpZ2h0IC0gc2VsZi5jb250YWluZXJQYWRkaW5nLnRvcCAtIHNlbGYuY29udGFpbmVyUGFkZGluZy5ib3R0b20gLSBzZWxmLmltYWdlQm9yZGVyV2lkdGgudG9wIC0gc2VsZi5pbWFnZUJvcmRlcldpZHRoLmJvdHRvbSAtIDEyMDtcblxuICAgICAgICAvLyBDaGVjayBpZiBpbWFnZSBzaXplIGlzIGxhcmdlciB0aGVuIG1heFdpZHRofG1heEhlaWdodCBpbiBzZXR0aW5nc1xuICAgICAgICBpZiAoc2VsZi5vcHRpb25zLm1heFdpZHRoICYmIHNlbGYub3B0aW9ucy5tYXhXaWR0aCA8IG1heEltYWdlV2lkdGgpIHtcbiAgICAgICAgICBtYXhJbWFnZVdpZHRoID0gc2VsZi5vcHRpb25zLm1heFdpZHRoO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzZWxmLm9wdGlvbnMubWF4SGVpZ2h0ICYmIHNlbGYub3B0aW9ucy5tYXhIZWlnaHQgPCBtYXhJbWFnZVdpZHRoKSB7XG4gICAgICAgICAgbWF4SW1hZ2VIZWlnaHQgPSBzZWxmLm9wdGlvbnMubWF4SGVpZ2h0O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSXMgdGhlcmUgYSBmaXR0aW5nIGlzc3VlP1xuICAgICAgICBpZiAoKHByZWxvYWRlci53aWR0aCA+IG1heEltYWdlV2lkdGgpIHx8IChwcmVsb2FkZXIuaGVpZ2h0ID4gbWF4SW1hZ2VIZWlnaHQpKSB7XG4gICAgICAgICAgaWYgKChwcmVsb2FkZXIud2lkdGggLyBtYXhJbWFnZVdpZHRoKSA+IChwcmVsb2FkZXIuaGVpZ2h0IC8gbWF4SW1hZ2VIZWlnaHQpKSB7XG4gICAgICAgICAgICBpbWFnZVdpZHRoICA9IG1heEltYWdlV2lkdGg7XG4gICAgICAgICAgICBpbWFnZUhlaWdodCA9IHBhcnNlSW50KHByZWxvYWRlci5oZWlnaHQgLyAocHJlbG9hZGVyLndpZHRoIC8gaW1hZ2VXaWR0aCksIDEwKTtcbiAgICAgICAgICAgICRpbWFnZS53aWR0aChpbWFnZVdpZHRoKTtcbiAgICAgICAgICAgICRpbWFnZS5oZWlnaHQoaW1hZ2VIZWlnaHQpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpbWFnZUhlaWdodCA9IG1heEltYWdlSGVpZ2h0O1xuICAgICAgICAgICAgaW1hZ2VXaWR0aCA9IHBhcnNlSW50KHByZWxvYWRlci53aWR0aCAvIChwcmVsb2FkZXIuaGVpZ2h0IC8gaW1hZ2VIZWlnaHQpLCAxMCk7XG4gICAgICAgICAgICAkaW1hZ2Uud2lkdGgoaW1hZ2VXaWR0aCk7XG4gICAgICAgICAgICAkaW1hZ2UuaGVpZ2h0KGltYWdlSGVpZ2h0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHNlbGYuc2l6ZUNvbnRhaW5lcigkaW1hZ2Uud2lkdGgoKSwgJGltYWdlLmhlaWdodCgpKTtcbiAgICB9O1xuXG4gICAgcHJlbG9hZGVyLnNyYyAgICAgICAgICA9IHRoaXMuYWxidW1baW1hZ2VOdW1iZXJdLmxpbms7XG4gICAgdGhpcy5jdXJyZW50SW1hZ2VJbmRleCA9IGltYWdlTnVtYmVyO1xuICB9O1xuXG4gIC8vIFN0cmV0Y2ggb3ZlcmxheSB0byBmaXQgdGhlIHZpZXdwb3J0XG4gIExpZ2h0Ym94LnByb3RvdHlwZS5zaXplT3ZlcmxheSA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuJG92ZXJsYXlcbiAgICAgIC53aWR0aCgkKGRvY3VtZW50KS53aWR0aCgpKVxuICAgICAgLmhlaWdodCgkKGRvY3VtZW50KS5oZWlnaHQoKSk7XG4gIH07XG5cbiAgLy8gQW5pbWF0ZSB0aGUgc2l6ZSBvZiB0aGUgbGlnaHRib3ggdG8gZml0IHRoZSBpbWFnZSB3ZSBhcmUgc2hvd2luZ1xuICBMaWdodGJveC5wcm90b3R5cGUuc2l6ZUNvbnRhaW5lciA9IGZ1bmN0aW9uKGltYWdlV2lkdGgsIGltYWdlSGVpZ2h0KSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIG9sZFdpZHRoICA9IHRoaXMuJG91dGVyQ29udGFpbmVyLm91dGVyV2lkdGgoKTtcbiAgICB2YXIgb2xkSGVpZ2h0ID0gdGhpcy4kb3V0ZXJDb250YWluZXIub3V0ZXJIZWlnaHQoKTtcbiAgICB2YXIgbmV3V2lkdGggID0gaW1hZ2VXaWR0aCArIHRoaXMuY29udGFpbmVyUGFkZGluZy5sZWZ0ICsgdGhpcy5jb250YWluZXJQYWRkaW5nLnJpZ2h0ICsgdGhpcy5pbWFnZUJvcmRlcldpZHRoLmxlZnQgKyB0aGlzLmltYWdlQm9yZGVyV2lkdGgucmlnaHQ7XG4gICAgdmFyIG5ld0hlaWdodCA9IGltYWdlSGVpZ2h0ICsgdGhpcy5jb250YWluZXJQYWRkaW5nLnRvcCArIHRoaXMuY29udGFpbmVyUGFkZGluZy5ib3R0b20gKyB0aGlzLmltYWdlQm9yZGVyV2lkdGgudG9wICsgdGhpcy5pbWFnZUJvcmRlcldpZHRoLmJvdHRvbTtcblxuICAgIGZ1bmN0aW9uIHBvc3RSZXNpemUoKSB7XG4gICAgICBzZWxmLiRsaWdodGJveC5maW5kKCcubGItZGF0YUNvbnRhaW5lcicpLndpZHRoKG5ld1dpZHRoKTtcbiAgICAgIHNlbGYuJGxpZ2h0Ym94LmZpbmQoJy5sYi1wcmV2TGluaycpLmhlaWdodChuZXdIZWlnaHQpO1xuICAgICAgc2VsZi4kbGlnaHRib3guZmluZCgnLmxiLW5leHRMaW5rJykuaGVpZ2h0KG5ld0hlaWdodCk7XG4gICAgICBzZWxmLnNob3dJbWFnZSgpO1xuICAgIH1cblxuICAgIGlmIChvbGRXaWR0aCAhPT0gbmV3V2lkdGggfHwgb2xkSGVpZ2h0ICE9PSBuZXdIZWlnaHQpIHtcbiAgICAgIHRoaXMuJG91dGVyQ29udGFpbmVyLmFuaW1hdGUoe1xuICAgICAgICB3aWR0aDogbmV3V2lkdGgsXG4gICAgICAgIGhlaWdodDogbmV3SGVpZ2h0XG4gICAgICB9LCB0aGlzLm9wdGlvbnMucmVzaXplRHVyYXRpb24sICdzd2luZycsIGZ1bmN0aW9uKCkge1xuICAgICAgICBwb3N0UmVzaXplKCk7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcG9zdFJlc2l6ZSgpO1xuICAgIH1cbiAgfTtcblxuICAvLyBEaXNwbGF5IHRoZSBpbWFnZSBhbmQgaXRzIGRldGFpbHMgYW5kIGJlZ2luIHByZWxvYWQgbmVpZ2hib3JpbmcgaW1hZ2VzLlxuICBMaWdodGJveC5wcm90b3R5cGUuc2hvd0ltYWdlID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy4kbGlnaHRib3guZmluZCgnLmxiLWxvYWRlcicpLnN0b3AodHJ1ZSkuaGlkZSgpO1xuICAgIHRoaXMuJGxpZ2h0Ym94LmZpbmQoJy5sYi1pbWFnZScpLmZhZGVJbih0aGlzLm9wdGlvbnMuaW1hZ2VGYWRlRHVyYXRpb24pO1xuXG4gICAgdGhpcy51cGRhdGVOYXYoKTtcbiAgICB0aGlzLnVwZGF0ZURldGFpbHMoKTtcbiAgICB0aGlzLnByZWxvYWROZWlnaGJvcmluZ0ltYWdlcygpO1xuICAgIHRoaXMuZW5hYmxlS2V5Ym9hcmROYXYoKTtcbiAgfTtcblxuICAvLyBEaXNwbGF5IHByZXZpb3VzIGFuZCBuZXh0IG5hdmlnYXRpb24gaWYgYXBwcm9wcmlhdGUuXG4gIExpZ2h0Ym94LnByb3RvdHlwZS51cGRhdGVOYXYgPSBmdW5jdGlvbigpIHtcbiAgICAvLyBDaGVjayB0byBzZWUgaWYgdGhlIGJyb3dzZXIgc3VwcG9ydHMgdG91Y2ggZXZlbnRzLiBJZiBzbywgd2UgdGFrZSB0aGUgY29uc2VydmF0aXZlIGFwcHJvYWNoXG4gICAgLy8gYW5kIGFzc3VtZSB0aGF0IG1vdXNlIGhvdmVyIGV2ZW50cyBhcmUgbm90IHN1cHBvcnRlZCBhbmQgYWx3YXlzIHNob3cgcHJldi9uZXh0IG5hdmlnYXRpb25cbiAgICAvLyBhcnJvd3MgaW4gaW1hZ2Ugc2V0cy5cbiAgICB2YXIgYWx3YXlzU2hvd05hdiA9IGZhbHNlO1xuICAgIHRyeSB7XG4gICAgICBkb2N1bWVudC5jcmVhdGVFdmVudCgnVG91Y2hFdmVudCcpO1xuICAgICAgYWx3YXlzU2hvd05hdiA9ICh0aGlzLm9wdGlvbnMuYWx3YXlzU2hvd05hdk9uVG91Y2hEZXZpY2VzKSA/IHRydWUgOiBmYWxzZTtcbiAgICB9IGNhdGNoIChlKSB7fVxuXG4gICAgdGhpcy4kbGlnaHRib3guZmluZCgnLmxiLW5hdicpLnNob3coKTtcblxuICAgIGlmICh0aGlzLmFsYnVtLmxlbmd0aCA+IDEpIHtcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMud3JhcEFyb3VuZCkge1xuICAgICAgICBpZiAoYWx3YXlzU2hvd05hdikge1xuICAgICAgICAgIHRoaXMuJGxpZ2h0Ym94LmZpbmQoJy5sYi1wcmV2LCAubGItbmV4dCcpLmNzcygnb3BhY2l0eScsICcxJyk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy4kbGlnaHRib3guZmluZCgnLmxiLXByZXYsIC5sYi1uZXh0Jykuc2hvdygpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHRoaXMuY3VycmVudEltYWdlSW5kZXggPiAwKSB7XG4gICAgICAgICAgdGhpcy4kbGlnaHRib3guZmluZCgnLmxiLXByZXYnKS5zaG93KCk7XG4gICAgICAgICAgaWYgKGFsd2F5c1Nob3dOYXYpIHtcbiAgICAgICAgICAgIHRoaXMuJGxpZ2h0Ym94LmZpbmQoJy5sYi1wcmV2JykuY3NzKCdvcGFjaXR5JywgJzEnKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuY3VycmVudEltYWdlSW5kZXggPCB0aGlzLmFsYnVtLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICB0aGlzLiRsaWdodGJveC5maW5kKCcubGItbmV4dCcpLnNob3coKTtcbiAgICAgICAgICBpZiAoYWx3YXlzU2hvd05hdikge1xuICAgICAgICAgICAgdGhpcy4kbGlnaHRib3guZmluZCgnLmxiLW5leHQnKS5jc3MoJ29wYWNpdHknLCAnMScpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICAvLyBEaXNwbGF5IGNhcHRpb24sIGltYWdlIG51bWJlciwgYW5kIGNsb3NpbmcgYnV0dG9uLlxuICBMaWdodGJveC5wcm90b3R5cGUudXBkYXRlRGV0YWlscyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIC8vIEVuYWJsZSBhbmNob3IgY2xpY2tzIGluIHRoZSBpbmplY3RlZCBjYXB0aW9uIGh0bWwuXG4gICAgLy8gVGhhbmtzIE5hdGUgV3JpZ2h0IGZvciB0aGUgZml4LiBAaHR0cHM6Ly9naXRodWIuY29tL05hdGVXclxuICAgIGlmICh0eXBlb2YgdGhpcy5hbGJ1bVt0aGlzLmN1cnJlbnRJbWFnZUluZGV4XS50aXRsZSAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICAgIHRoaXMuYWxidW1bdGhpcy5jdXJyZW50SW1hZ2VJbmRleF0udGl0bGUgIT09ICcnKSB7XG4gICAgICB2YXIgJGNhcHRpb24gPSB0aGlzLiRsaWdodGJveC5maW5kKCcubGItY2FwdGlvbicpO1xuICAgICAgaWYgKHRoaXMub3B0aW9ucy5zYW5pdGl6ZVRpdGxlKSB7XG4gICAgICAgICRjYXB0aW9uLnRleHQodGhpcy5hbGJ1bVt0aGlzLmN1cnJlbnRJbWFnZUluZGV4XS50aXRsZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAkY2FwdGlvbi5odG1sKHRoaXMuYWxidW1bdGhpcy5jdXJyZW50SW1hZ2VJbmRleF0udGl0bGUpO1xuICAgICAgfVxuICAgICAgJGNhcHRpb24uZmFkZUluKCdmYXN0JylcbiAgICAgICAgLmZpbmQoJ2EnKS5vbignY2xpY2snLCBmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgIGlmICgkKHRoaXMpLmF0dHIoJ3RhcmdldCcpICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHdpbmRvdy5vcGVuKCQodGhpcykuYXR0cignaHJlZicpLCAkKHRoaXMpLmF0dHIoJ3RhcmdldCcpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbG9jYXRpb24uaHJlZiA9ICQodGhpcykuYXR0cignaHJlZicpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuYWxidW0ubGVuZ3RoID4gMSAmJiB0aGlzLm9wdGlvbnMuc2hvd0ltYWdlTnVtYmVyTGFiZWwpIHtcbiAgICAgIHZhciBsYWJlbFRleHQgPSB0aGlzLmltYWdlQ291bnRMYWJlbCh0aGlzLmN1cnJlbnRJbWFnZUluZGV4ICsgMSwgdGhpcy5hbGJ1bS5sZW5ndGgpO1xuICAgICAgdGhpcy4kbGlnaHRib3guZmluZCgnLmxiLW51bWJlcicpLnRleHQobGFiZWxUZXh0KS5mYWRlSW4oJ2Zhc3QnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy4kbGlnaHRib3guZmluZCgnLmxiLW51bWJlcicpLmhpZGUoKTtcbiAgICB9XG5cbiAgICB0aGlzLiRvdXRlckNvbnRhaW5lci5yZW1vdmVDbGFzcygnYW5pbWF0aW5nJyk7XG5cbiAgICB0aGlzLiRsaWdodGJveC5maW5kKCcubGItZGF0YUNvbnRhaW5lcicpLmZhZGVJbih0aGlzLm9wdGlvbnMucmVzaXplRHVyYXRpb24sIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHNlbGYuc2l6ZU92ZXJsYXkoKTtcbiAgICB9KTtcbiAgfTtcblxuICAvLyBQcmVsb2FkIHByZXZpb3VzIGFuZCBuZXh0IGltYWdlcyBpbiBzZXQuXG4gIExpZ2h0Ym94LnByb3RvdHlwZS5wcmVsb2FkTmVpZ2hib3JpbmdJbWFnZXMgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5hbGJ1bS5sZW5ndGggPiB0aGlzLmN1cnJlbnRJbWFnZUluZGV4ICsgMSkge1xuICAgICAgdmFyIHByZWxvYWROZXh0ID0gbmV3IEltYWdlKCk7XG4gICAgICBwcmVsb2FkTmV4dC5zcmMgPSB0aGlzLmFsYnVtW3RoaXMuY3VycmVudEltYWdlSW5kZXggKyAxXS5saW5rO1xuICAgIH1cbiAgICBpZiAodGhpcy5jdXJyZW50SW1hZ2VJbmRleCA+IDApIHtcbiAgICAgIHZhciBwcmVsb2FkUHJldiA9IG5ldyBJbWFnZSgpO1xuICAgICAgcHJlbG9hZFByZXYuc3JjID0gdGhpcy5hbGJ1bVt0aGlzLmN1cnJlbnRJbWFnZUluZGV4IC0gMV0ubGluaztcbiAgICB9XG4gIH07XG5cbiAgTGlnaHRib3gucHJvdG90eXBlLmVuYWJsZUtleWJvYXJkTmF2ID0gZnVuY3Rpb24oKSB7XG4gICAgJChkb2N1bWVudCkub24oJ2tleXVwLmtleWJvYXJkJywgJC5wcm94eSh0aGlzLmtleWJvYXJkQWN0aW9uLCB0aGlzKSk7XG4gIH07XG5cbiAgTGlnaHRib3gucHJvdG90eXBlLmRpc2FibGVLZXlib2FyZE5hdiA9IGZ1bmN0aW9uKCkge1xuICAgICQoZG9jdW1lbnQpLm9mZignLmtleWJvYXJkJyk7XG4gIH07XG5cbiAgTGlnaHRib3gucHJvdG90eXBlLmtleWJvYXJkQWN0aW9uID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICB2YXIgS0VZQ09ERV9FU0MgICAgICAgID0gMjc7XG4gICAgdmFyIEtFWUNPREVfTEVGVEFSUk9XICA9IDM3O1xuICAgIHZhciBLRVlDT0RFX1JJR0hUQVJST1cgPSAzOTtcblxuICAgIHZhciBrZXljb2RlID0gZXZlbnQua2V5Q29kZTtcbiAgICB2YXIga2V5ICAgICA9IFN0cmluZy5mcm9tQ2hhckNvZGUoa2V5Y29kZSkudG9Mb3dlckNhc2UoKTtcbiAgICBpZiAoa2V5Y29kZSA9PT0gS0VZQ09ERV9FU0MgfHwga2V5Lm1hdGNoKC94fG98Yy8pKSB7XG4gICAgICB0aGlzLmVuZCgpO1xuICAgIH0gZWxzZSBpZiAoa2V5ID09PSAncCcgfHwga2V5Y29kZSA9PT0gS0VZQ09ERV9MRUZUQVJST1cpIHtcbiAgICAgIGlmICh0aGlzLmN1cnJlbnRJbWFnZUluZGV4ICE9PSAwKSB7XG4gICAgICAgIHRoaXMuY2hhbmdlSW1hZ2UodGhpcy5jdXJyZW50SW1hZ2VJbmRleCAtIDEpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLm9wdGlvbnMud3JhcEFyb3VuZCAmJiB0aGlzLmFsYnVtLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgdGhpcy5jaGFuZ2VJbWFnZSh0aGlzLmFsYnVtLmxlbmd0aCAtIDEpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoa2V5ID09PSAnbicgfHwga2V5Y29kZSA9PT0gS0VZQ09ERV9SSUdIVEFSUk9XKSB7XG4gICAgICBpZiAodGhpcy5jdXJyZW50SW1hZ2VJbmRleCAhPT0gdGhpcy5hbGJ1bS5sZW5ndGggLSAxKSB7XG4gICAgICAgIHRoaXMuY2hhbmdlSW1hZ2UodGhpcy5jdXJyZW50SW1hZ2VJbmRleCArIDEpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLm9wdGlvbnMud3JhcEFyb3VuZCAmJiB0aGlzLmFsYnVtLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgdGhpcy5jaGFuZ2VJbWFnZSgwKTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgLy8gQ2xvc2luZyB0aW1lLiA6LShcbiAgTGlnaHRib3gucHJvdG90eXBlLmVuZCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuZGlzYWJsZUtleWJvYXJkTmF2KCk7XG4gICAgJCh3aW5kb3cpLm9mZigncmVzaXplJywgdGhpcy5zaXplT3ZlcmxheSk7XG4gICAgdGhpcy4kbGlnaHRib3guZmFkZU91dCh0aGlzLm9wdGlvbnMuZmFkZUR1cmF0aW9uKTtcbiAgICB0aGlzLiRvdmVybGF5LmZhZGVPdXQodGhpcy5vcHRpb25zLmZhZGVEdXJhdGlvbik7XG4gICAgJCgnc2VsZWN0LCBvYmplY3QsIGVtYmVkJykuY3NzKHtcbiAgICAgIHZpc2liaWxpdHk6ICd2aXNpYmxlJ1xuICAgIH0pO1xuICAgIGlmICh0aGlzLm9wdGlvbnMuZGlzYWJsZVNjcm9sbGluZykge1xuICAgICAgJCgnYm9keScpLnJlbW92ZUNsYXNzKCdsYi1kaXNhYmxlLXNjcm9sbGluZycpO1xuICAgIH1cbiAgfTtcblxuICByZXR1cm4gbmV3IExpZ2h0Ym94KCk7XG59KSk7XG4iXSwiZmlsZSI6ImxpZ2h0Ym94LmpzIn0=
