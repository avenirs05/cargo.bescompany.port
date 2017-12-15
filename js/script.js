$(document).ready(function() {
    $('input[name=phone_f]').mask('+7 ( 999 ) 999-99-99'); // mask

    $("#owl-works").owlCarousel({
        loop: true,
        margin: 25,
        mouseDrag: true,
        touchDrag: true,
        nav: true,
        navText: ['<i class="icon icon-s-link_slider">', '<i class="icon icon-s-link_slider_right">'],
        responsive: {
            0: {
                items: 1
            },
            450: {
                items: 2
            },
            1100: {
                items: 3
            }
        }
    });
	
	$("#owl-example").owlCarousel({
        loop: true,
        margin: 25,
        mouseDrag: true,
        touchDrag: true,
        nav: true,
        navText: ['<i class="icon icon-s-link_slider">', '<i class="icon icon-s-link_slider_right">'],
        responsive: {
            0: {
                items: 1
            },
            450: {
                items: 1
            },
            1100: {
                items: 1
            }
        }
    });
	var owl = $("#owl-example");
	$(".ex_next").click(function () {
        owl.trigger('next.owl.carousel');
    }),
    $(".ex_prev").click(function () {
        owl.trigger('prev.owl.carousel');
    });
});


// $('a[href^="#"]').click(function(){
$("body").on('click', '[href*="#"]', function(e){
  var fixed_offset = 100;
  $('html,body').stop().animate({ scrollTop: $(this.hash).offset().top - fixed_offset }, 1000);
  e.preventDefault();
});

function cnt6_form() {
	var form_class=$("#cnt6_form").attr("class");
    var e = $("#cnt6_form").serialize();
	console.log(e);
	var msg2 = e.split('&');
	console.log(msg2);
    var msg3 = msg2[2].split('=');
	console.log(msg3);
    if (!msg3[1]=='') {
    $.ajax({
        type: "POST",
        url: "include/send.php",
        data: e,
        success: function(e) {
            $("#thx").click();
			if(form_class.indexOf("costs_logistics") + 1){ 
				ga('send','event','forms','costs_logistics');
				yaCounter44091369.reachGoal('costs_logistics');
			}
        },
        error: function(e, c) {
            alert("Возникла ошибка: " + e.responseCode)
        }
    });
	} else {
		$("#cnt6_form").find('[name = "phone_f"]').css({
            'border-color' : 'red'
        });
	}
};

function cnt9_form() {
	var form_class=$("#cnt9_form").attr("class");
    var e = $("#cnt9_form").serialize();
	console.log(e);
	var msg2 = e.split('&');
	console.log(msg2);
    var msg3 = msg2[2].split('=');
	console.log(msg3);
    if (!msg3[1]=='') {
    $.ajax({
        type: "POST",
        url: "include/send.php",
        data: e,
        success: function(e) {
            $("#thx").click();
			if(form_class.indexOf("deliv_cost_cargo") + 1){ 
				ga('send','event','forms','deliv_cost_cargo');
				yaCounter44091369.reachGoal('deliv_cost_cargo');
			}
			if(form_class.indexOf("guar_decl_customs") + 1){ 
				ga('send','event','forms','guar_decl_customs');
				yaCounter44091369.reachGoal('guar_decl_customs');
			}
        },
        error: function(e, c) {
            alert("Возникла ошибка: " + e.responseCode)
        }
    });
	} else {
		$("#cnt9_form").find('[name = "phone_f"]').css({
            'border-color' : 'red'
        });
	}
};

function cnt11_form() {
	var form_class=$("#cnt11_form").attr("class");
    var e = $("#cnt11_form").serialize();
	console.log(e);
	var msg2 = e.split('&');
	console.log(msg2);
    var msg3 = msg2[2].split('=');
	console.log(msg3);
    if (!msg3[1]=='') {
    $.ajax({
        type: "POST",
        url: "include/send.php",
        data: e,
        success: function(e) {
            $("#thx").click();
			if(form_class.indexOf("guar_trans_cost") + 1){ 
				ga('send','event','forms','guar_trans_cost');
				yaCounter44091369.reachGoal('guar_trans_cost');
			}
			if(form_class.indexOf("any_doc_customs") + 1){ 
				ga('send','event','forms','any_doc_customs');
				yaCounter44091369.reachGoal('any_doc_customs');
			}
        },
        error: function(e, c) {
            alert("Возникла ошибка: " + e.responseCode)
        }
    });
	} else {
		$("#cnt11_form").find('[name = "phone_f"]').css({
            'border-color' : 'red'
        });
	}
};
function cnt17_form() {
	var form_class=$("#cnt17_form").attr("class");
    var e = $("#cnt17_form").serialize();
	console.log(e);
	var msg2 = e.split('&');
	console.log(msg2);
    var msg3 = msg2[2].split('=');
	console.log(msg3);
    if (!msg3[1]=='') {
    $.ajax({
        type: "POST",
        url: "include/send.php",
        data: e,
        success: function(e) {
            $("#thx").click();
			if(form_class.indexOf("trans_cargo_quickly") + 1){ 
				ga('send','event','forms','trans_cargo_quickly');
				yaCounter44091369.reachGoal('trans_cargo_quickly');
			}
			if(form_class.indexOf("customs_reg_quickly") + 1){ 
				ga('send','event','forms','customs_reg_quickly');
				yaCounter44091369.reachGoal('customs_reg_quickly');
			}
        },
        error: function(e, c) {
            alert("Возникла ошибка: " + e.responseCode)
        }
    });
	} else {
		$("#cnt17_form").find('[name = "phone_f"]').css({
            'border-color' : 'red'
        });
	}
};
function cnt20_form() {
	var form_class=$("#cnt20_form").attr("class");
    var e = $("#cnt20_form").serialize();
	console.log(e);
	var msg2 = e.split('&');
	console.log(msg2);
    var msg3 = msg2[2].split('=');
	console.log(msg3);
    if (!msg3[1]=='') {
    $.ajax({
        type: "POST",
        url: "include/send.php",
        data: e,
        success: function(e) {
            $("#thx").click();
			if(form_class.indexOf("begin_trans_cargo") + 1){ 
				ga('send','event','forms','begin_trans_cargo');
				yaCounter44091369.reachGoal('begin_trans_cargo');
			}
			if(form_class.indexOf("begin_customs_reg") + 1){ 
				ga('send','event','forms','begin_customs_reg');
				yaCounter44091369.reachGoal('begin_customs_reg');
			}
        },
        error: function(e, c) {
            alert("Возникла ошибка: " + e.responseCode)
        }
    });
	} else {
		$("#cnt20_form").find('[name = "phone_f"]').css({
            'border-color' : 'red'
        });
	}
};
function modal_form() {
	var form_class=$("#modal_form").attr("class");
    var e = $("#modal_form").serialize();
	console.log(e);
	var msg2 = e.split('&');
	console.log(msg2);
    var msg3 = msg2[2].split('=');
	console.log(msg3);
    if (!msg3[1]=='') {
    $.ajax({
        type: "POST",
        url: "include/send.php",
        data: e,
        success: function(e) {
            $(".close").click(), $("#thx").click();
			if(form_class.indexOf("call_back") + 1){ 
				ga('send','event','forms','call_back');
				yaCounter44091369.reachGoal('call_back');
			}
        },
        error: function(e, c) {
            alert("Возникла ошибка: " + e.responseCode)
        }
    });
	} else {
		$("#modal_form").find('[name = "phone_f"]').css({
            'border-color' : 'red'
        });
	}
};

function second_form() {
	var form_class=$("#second_form").attr("class");
    var e = $("#second_form").serialize();
	console.log(e);
	var msg2 = e.split('&');
	console.log(msg2);
    var msg3 = msg2[2].split('=');
	console.log(msg3);
    if (!msg3[1]=='') {
    $.ajax({
        type: "POST",
        url: "include/send.php",
        data: e,
        success: function(e) {
            $(".close").click(), $("#thx").click();
			if(form_class.indexOf("trans_cargo") + 1){ 
				ga('send','event','forms','trans_cargo');
				yaCounter44091369.reachGoal('trans_cargo');
			}
			if(form_class.indexOf("pass_customs") + 1){ 
				ga('send','event','forms','pass_customs');
				yaCounter44091369.reachGoal('pass_customs');
			}
        },
        error: function(e, c) {
            alert("Возникла ошибка: " + e.responseCode)
        }
    });
	} else {
		$("#second_form").find('[name = "phone_f"]').css({
            'border-color' : 'red'
        });
	}
};
// -------------------------------------------------------------
//   Force Centered Navigation
// -------------------------------------------------------------
(function () {
    var $frame = $('#forcecentered');
    var $wrap  = $frame.parent();

    // Call Sly on frame
    $frame.sly({
        horizontal: 1,
        itemNav: 'forceCentered',
        smart: 1,
        activateMiddle: 1,
        activateOn: 'click',
        mouseDragging: 1,
        touchDragging: 1,
        releaseSwing: 1,
        startAt: 0,
        scrollBar: $wrap.find('.scrollbar'),
        scrollBy: 0,
        speed: 0.1,
        elasticBounds: 1,
        easing: 'easeOutExpo',
        dragHandle: 1,
        dynamicHandle: 1,
        clickBar: 1
    });
}());


/* map */
google.maps.event.addDomListener(window, 'load', init);
var map, markersArray = [];

function bindInfoWindow(marker, map, location) {
    google.maps.event.addListener(marker, 'click', function() {
        function close(location) {
            location.ib.close();
            location.infoWindowVisible = false;
            location.ib = null;
        }

        if (location.infoWindowVisible === true) {
            close(location);
        } else {
            markersArray.forEach(function(loc, index){
                if (loc.ib && loc.ib !== null) {
                    close(loc);
                }
            });

            var boxText = document.createElement('div');
            boxText.style.cssText = 'background: #fff;';
            boxText.classList.add('md-whiteframe-2dp');

            function buildPieces(location, el, part, icon) {
                if (location[part] === '') {
                    return '';
                } else if (location.iw[part]) {
                    switch(el){
                        case 'photo':
                            if (location.photo){
                                return '<div class="iw-photo" style="background-image: url(' + location.photo + ');"></div>';
                            } else {
                                return '';
                            }
                            break;
                        case 'iw-toolbar':
                            return '<div class="iw-toolbar"><h3 class="md-subhead">' + location.title + '</h3></div>';
                            break;
                        case 'div':
                            switch(part){
                                case 'email':
                                    return '<div class="iw-details"><i class="material-icons" style="color:#4285f4;"><img src="//cdn.mapkit.io/v1/icons/' + icon + '.svg"/></i><span><a href="mailto:' + location.email + '" target="_blank">' + location.email + '</a></span></div>';
                                    break;
                                case 'web':
                                    return '<div class="iw-details"><i class="material-icons" style="color:#4285f4;"><img src="//cdn.mapkit.io/v1/icons/' + icon + '.svg"/></i><span><a href="' + location.web + '" target="_blank">' + location.web_formatted + '</a></span></div>';
                                    break;
                                case 'desc':
                                    return '<label class="iw-desc" for="cb_details"><input type="checkbox" id="cb_details"/><h3 class="iw-x-details">Details</h3><i class="material-icons toggle-open-details"><img src="//cdn.mapkit.io/v1/icons/' + icon + '.svg"/></i><p class="iw-x-details">' + location.desc + '</p></label>';
                                    break;
                                default:
                                    return '<div class="iw-details"><i class="material-icons"><img src="//cdn.mapkit.io/v1/icons/' + icon + '.svg"/></i><span>' + location[part] + '</span></div>';
                                    break;
                            }
                            break;
                        case 'open_hours':
                            var items = '';
                            if (location.open_hours.length > 0){
                                for (var i = 0; i < location.open_hours.length; ++i) {
                                    if (i !== 0){
                                        items += '<li><strong>' + location.open_hours[i].day + '</strong><strong>' + location.open_hours[i].hours +'</strong></li>';
                                    }
                                    var first = '<li><label for="cb_hours"><input type="checkbox" id="cb_hours"/><strong>' + location.open_hours[0].day + '</strong><strong>' + location.open_hours[0].hours +'</strong><i class="material-icons toggle-open-hours"><img src="//cdn.mapkit.io/v1/icons/keyboard_arrow_down.svg"/></i><ul>' + items + '</ul></label></li>';
                                }
                                return '<div class="iw-list"><i class="material-icons first-material-icons" style="color:#4285f4;"><img src="//cdn.mapkit.io/v1/icons/' + icon + '.svg"/></i><ul>' + first + '</ul></div>';
                            } else {
                                return '';
                            }
                            break;
                    }
                } else {
                    return '';
                }
            }

            boxText.innerHTML =
                buildPieces(location, 'photo', 'photo', '') +
                buildPieces(location, 'iw-toolbar', 'title', '') +
                buildPieces(location, 'div', 'address', 'location_on') +
                buildPieces(location, 'div', 'web', 'public') +
                buildPieces(location, 'div', 'email', 'email') +
                buildPieces(location, 'div', 'tel', 'phone') +
                buildPieces(location, 'div', 'int_tel', 'phone') +
                buildPieces(location, 'open_hours', 'open_hours', 'access_time') +
                buildPieces(location, 'div', 'desc', 'keyboard_arrow_down');

            var myOptions = {
                alignBottom: true,
                content: boxText,
                disableAutoPan: true,
                maxWidth: 0,
                pixelOffset: new google.maps.Size(-140, -40),
                zIndex: null,
                boxStyle: {
                    opacity: 1,
                    width: '280px'
                },
                closeBoxMargin: '0px 0px 0px 0px',
                infoBoxClearance: new google.maps.Size(1, 1),
                isHidden: false,
                pane: 'floatPane',
                enableEventPropagation: false
            };

            location.ib = new InfoBox(myOptions);
            location.ib.open(map, marker);
            location.infoWindowVisible = true;
        }
    });
}

function init() {
	if ($(window).width() <= '1020'){
         var mapOptions = {
        center: new google.maps.LatLng(55.8050148,37.58993889999999),
        zoom: 16,
        gestureHandling: 'auto',
        fullscreenControl: false,
        zoomControl: true,
        disableDoubleClickZoom: true,
        mapTypeControl: false,
        scaleControl: true,
        scrollwheel: false,
        streetViewControl: false,
        draggable : true,
        clickableIcons: false,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: [{"featureType": "water","elementType": "geometry","stylers": [{ "color": "#193341" }]},{"featureType": "landscape","elementType": "geometry","stylers": [{ "color": "#2c5a71" }]},{"featureType": "road","elementType": "geometry","stylers": [{ "color": "#29768a" },{ "lightness": -37 }]},{"featureType": "poi","elementType": "geometry","stylers": [{ "color": "#406d80" }]},{"featureType": "transit","elementType": "geometry","stylers": [{ "color": "#406d80" }]},{"elementType": "labels.text.stroke","stylers": [{ "visibility": "on" },{ "color": "#3e606f" },{ "weight": 2 },{ "gamma": 0.84 }]},{"elementType": "labels.text.fill","stylers": [{ "color": "#ffffff" }]},{"featureType": "administrative","elementType": "geometry","stylers": [{ "weight": 0.6 },{ "color": "#1a3541" }]},{"elementType": "labels.icon","stylers": [{ "visibility": "off" }]},{"featureType": "poi.park","elementType": "geometry","stylers": [{ "color": "#2c5a71" }]}]
    } 
	}
    else {
		var mapOptions = {
        center: new google.maps.LatLng(55.805212808487425,37.58297047450255),
        zoom: 16,
        gestureHandling: 'auto',
        fullscreenControl: false,
        zoomControl: true,
        disableDoubleClickZoom: true,
        mapTypeControl: false,
        scaleControl: true,
        scrollwheel: false,
        streetViewControl: false,
        draggable : true,
        clickableIcons: false,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: [{"featureType": "water","elementType": "geometry","stylers": [{ "color": "#193341" }]},{"featureType": "landscape","elementType": "geometry","stylers": [{ "color": "#2c5a71" }]},{"featureType": "road","elementType": "geometry","stylers": [{ "color": "#29768a" },{ "lightness": -37 }]},{"featureType": "poi","elementType": "geometry","stylers": [{ "color": "#406d80" }]},{"featureType": "transit","elementType": "geometry","stylers": [{ "color": "#406d80" }]},{"elementType": "labels.text.stroke","stylers": [{ "visibility": "on" },{ "color": "#3e606f" },{ "weight": 2 },{ "gamma": 0.84 }]},{"elementType": "labels.text.fill","stylers": [{ "color": "#ffffff" }]},{"featureType": "administrative","elementType": "geometry","stylers": [{ "weight": 0.6 },{ "color": "#1a3541" }]},{"elementType": "labels.icon","stylers": [{ "visibility": "off" }]},{"featureType": "poi.park","elementType": "geometry","stylers": [{ "color": "#2c5a71" }]}]
    }
	}
    var mapElement = document.getElementById('map');
    var map = new google.maps.Map(mapElement, mapOptions);
    var locations = [
        {"title":"Новодмитровская ул., 2 к1","address":"Новодмитровская ул., 2 к1, Москва, Россия, 127015","desc":"","tel":"","int_tel":"","email":"","web":"","web_formatted":"","open":"","time":"","lat":55.8050148,"lng":37.58993889999999,"vicinity":"Новодмитровская ул., 2 к1, Москва, Россия, 127015","open_hours":"","marker":{"url":"images/marker.png","scaledSize":{"width":49,"height":60,"j":"px","f":"px"},"origin":{"x":0,"y":0},"anchor":{"x":12,"y":42}},"iw":{"address":true,"desc":true,"email":true,"enable":true,"int_tel":true,"open":true,"open_hours":true,"photo":true,"tel":true,"title":true,"web":true}}
    ];
    for (i = 0; i < locations.length; i++) {
        marker = new google.maps.Marker({
            icon: locations[i].marker,
            position: new google.maps.LatLng(locations[i].lat, locations[i].lng),
            map: map,
            title: locations[i].title,
            address: locations[i].address,
            desc: locations[i].desc,
            tel: locations[i].tel,
            int_tel: locations[i].int_tel,
            vicinity: locations[i].vicinity,
            open: locations[i].open,
            open_hours: locations[i].open_hours,
            photo: locations[i].photo,
            time: locations[i].time,
            email: locations[i].email,
            web: locations[i].web,
            iw: locations[i].iw
        });
        markersArray.push(marker);

        if (locations[i].iw.enable === true){
            bindInfoWindow(marker, map, locations[i]);
        }
    }
}
function init2() {
	if ($(window).width() <= '1020'){
    var mapOptions = {
        center: new google.maps.LatLng(59.91435629999999,30.274025400000028),
        zoom: 15,
        gestureHandling: 'auto',
        fullscreenControl: false,
        zoomControl: true,
        disableDoubleClickZoom: true,
        mapTypeControl: false,
        scaleControl: true,
        scrollwheel: false,
        streetViewControl: false,
        draggable : true,
        clickableIcons: false,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: [{"featureType": "water","elementType": "geometry","stylers": [{ "color": "#193341" }]},{"featureType": "landscape","elementType": "geometry","stylers": [{ "color": "#2c5a71" }]},{"featureType": "road","elementType": "geometry","stylers": [{ "color": "#29768a" },{ "lightness": -37 }]},{"featureType": "poi","elementType": "geometry","stylers": [{ "color": "#406d80" }]},{"featureType": "transit","elementType": "geometry","stylers": [{ "color": "#406d80" }]},{"elementType": "labels.text.stroke","stylers": [{ "visibility": "on" },{ "color": "#3e606f" },{ "weight": 2 },{ "gamma": 0.84 }]},{"elementType": "labels.text.fill","stylers": [{ "color": "#ffffff" }]},{"featureType": "administrative","elementType": "geometry","stylers": [{ "weight": 0.6 },{ "color": "#1a3541" }]},{"elementType": "labels.icon","stylers": [{ "visibility": "off" }]},{"featureType": "poi.park","elementType": "geometry","stylers": [{ "color": "#2c5a71" }]}]
    }
	}
	else {
		var mapOptions = {
        center: new google.maps.LatLng(59.914891790153966,30.25908889033507),
        zoom: 15,
        gestureHandling: 'auto',
        fullscreenControl: false,
        zoomControl: true,
        disableDoubleClickZoom: true,
        mapTypeControl: false,
        scaleControl: true,
        scrollwheel: false,
        streetViewControl: false,
        draggable : true,
        clickableIcons: false,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: [{"featureType": "water","elementType": "geometry","stylers": [{ "color": "#193341" }]},{"featureType": "landscape","elementType": "geometry","stylers": [{ "color": "#2c5a71" }]},{"featureType": "road","elementType": "geometry","stylers": [{ "color": "#29768a" },{ "lightness": -37 }]},{"featureType": "poi","elementType": "geometry","stylers": [{ "color": "#406d80" }]},{"featureType": "transit","elementType": "geometry","stylers": [{ "color": "#406d80" }]},{"elementType": "labels.text.stroke","stylers": [{ "visibility": "on" },{ "color": "#3e606f" },{ "weight": 2 },{ "gamma": 0.84 }]},{"elementType": "labels.text.fill","stylers": [{ "color": "#ffffff" }]},{"featureType": "administrative","elementType": "geometry","stylers": [{ "weight": 0.6 },{ "color": "#1a3541" }]},{"elementType": "labels.icon","stylers": [{ "visibility": "off" }]},{"featureType": "poi.park","elementType": "geometry","stylers": [{ "color": "#2c5a71" }]}]
    }
	}
    var mapElement = document.getElementById('map');
    var map = new google.maps.Map(mapElement, mapOptions);
    var locations = [
        {"title":"Рижский пр., 41","address":"Рижский пр., 41, Санкт-Петербург, Россия, 190020","desc":"","tel":"","int_tel":"","email":"","web":"","web_formatted":"","open":"","time":"","lat":59.91435629999999,"lng":30.274025400000028,"vicinity":"Рижский пр., 41, Санкт-Петербург, Россия, 190020","open_hours":"","marker":{"url":"images/marker.png","scaledSize":{"width":49,"height":60,"j":"px","f":"px"},"origin":{"x":0,"y":0},"anchor":{"x":12,"y":42}},"iw":{"address":true,"desc":true,"email":true,"enable":true,"int_tel":true,"open":true,"open_hours":true,"photo":true,"tel":true,"title":true,"web":true}}
    ];
    for (i = 0; i < locations.length; i++) {
        marker = new google.maps.Marker({
            icon: locations[i].marker,
            position: new google.maps.LatLng(locations[i].lat, locations[i].lng),
            map: map,
            title: locations[i].title,
            address: locations[i].address,
            desc: locations[i].desc,
            tel: locations[i].tel,
            int_tel: locations[i].int_tel,
            vicinity: locations[i].vicinity,
            open: locations[i].open,
            open_hours: locations[i].open_hours,
            photo: locations[i].photo,
            time: locations[i].time,
            email: locations[i].email,
            web: locations[i].web,
            iw: locations[i].iw
        });
        markersArray.push(marker);

        if (locations[i].iw.enable === true){
            bindInfoWindow(marker, map, locations[i]);
        }
    }
};

$('#first_map').click(function () {
    $('.links_block').removeClass("active");
    $(this).addClass("active");
    init();
});
$('#second_map').click(function () {
    $('.links_block').removeClass("active");
    $(this).addClass("active");
    init2();
});
lightbox.option({
      'showImageNumberLabel': false
});