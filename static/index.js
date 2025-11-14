'use strict';

(function() {
  var Marzipano = window.Marzipano;
  var bowser = window.bowser;
  var screenfull = window.screenfull;
  var data = window.APP_DATA;

  // DOM elements
  var panoElement = document.querySelector('#pano');
  var sceneNameElement = document.querySelector('#titleBar .sceneName');
  var sceneListElement = document.querySelector('#sceneList');
  var sceneElements = document.querySelectorAll('#sceneList .scene');
  var sceneListToggleElement = document.querySelector('#sceneListToggle');
  var autorotateToggleElement = document.querySelector('#autorotateToggle');
  var fullscreenToggleElement = document.querySelector('#fullscreenToggle');

  // Detect desktop or mobile
  if (window.matchMedia) {
    var mql = matchMedia("(max-width: 500px), (max-height: 500px)");
    var setMode = function() {
      if (mql.matches) {
        document.body.classList.add('mobile');
        document.body.classList.remove('desktop');
      } else {
        document.body.classList.add('desktop');
        document.body.classList.remove('mobile');
      }
    };
    setMode();
    mql.addListener(setMode);
  }

  // Touch detection
  document.body.classList.add('no-touch');
  window.addEventListener('touchstart', function() {
    document.body.classList.remove('no-touch');
    document.body.classList.add('touch');
  });

  // Tooltip fallback for IE
  if (bowser.msie && parseFloat(bowser.version) < 11) {
    document.body.classList.add('tooltip-fallback');
  }

  // Viewer setup
  var viewerOpts = {
    controls: { mouseViewMode: data.settings.mouseViewMode }
  };
  var viewer = new Marzipano.Viewer(panoElement, viewerOpts);

  // ============= PREVIOUS SUPABASE CONFIGURATION (EQUIRECTANGULAR) START =============

  // Supabase base URL for single images
  var SUPABASE_BASE_URL = 'https://ggzftdlppjdrqugcrhgz.supabase.co/storage/v1/object/public/iittnifvirtualtour/images';
  var SUPABASE_IMAGES_URL = 'https://ggzftdlppjdrqugcrhgz.supabase.co/storage/v1/object/public/iittnifvirtualtour/images%20(1)/img';
  var USE_SUPABASE = true;

  // Create scenes from single 360 images
  var scenes = data.scenes.map(function(sceneData) {
    var imageUrl;
    if (USE_SUPABASE) {
      imageUrl = SUPABASE_BASE_URL + '/' + sceneData.id + '.jpg';
    } else {
      // Local fallback
      imageUrl = 'static/images/' + sceneData.id + '.jpg';
    }

    // Load single equirectangular image source
    var source = Marzipano.ImageUrlSource.fromString(imageUrl);

    // Geometry for equirectangular projection
    var geometry = new Marzipano.EquirectGeometry([{ width: 4000 }]); // Assuming 4K images

    // Limit FOV and set initial view
    var limiter = Marzipano.RectilinearView.limit.traditional(1024, 100*Math.PI/180, 120*Math.PI/180);
    var view = new Marzipano.RectilinearView(sceneData.initialViewParameters, limiter);

    // Create scene
    var scene = viewer.createScene({
      source: source,
      geometry: geometry,
      view: view,
      pinFirstLevel: true
    });

    // Add link hotspots
    sceneData.linkHotspots.forEach(function(hs) {
      var el = createLinkHotspotElement(hs);
      scene.hotspotContainer().createHotspot(el, { yaw: hs.yaw, pitch: hs.pitch });
    });

    // Add info hotspots
    sceneData.infoHotspots.forEach(function(hs) {
      var el = createInfoHotspotElement(hs);
      scene.hotspotContainer().createHotspot(el, { yaw: hs.yaw, pitch: hs.pitch });
    });

    return { data: sceneData, scene: scene, view: view };
  });

  // ============= PREVIOUS SUPABASE CONFIGURATION (EQUIRECTANGULAR) END =============

  var autorotate = Marzipano.autorotate({
    yawSpeed: 0.03,
    targetPitch: 0,
    targetFov: Math.PI/2
  });
  if (data.settings.autorotateEnabled) {
    autorotateToggleElement.classList.add('enabled');
  }

  // Set handler for autorotate toggle.
  autorotateToggleElement.addEventListener('click', toggleAutorotate);

  // Set up fullscreen mode, if supported.
  if (screenfull.enabled && data.settings.fullscreenButton) {
    document.body.classList.add('fullscreen-enabled');
    fullscreenToggleElement.addEventListener('click', function() {
      screenfull.toggle();
    });
    screenfull.on('change', function() {
      if (screenfull.isFullscreen) {
        fullscreenToggleElement.classList.add('enabled');
      } else {
        fullscreenToggleElement.classList.remove('enabled');
      }
    });
  } else {
    document.body.classList.add('fullscreen-disabled');
  }

  // Set handler for scene list toggle.
  sceneListToggleElement.addEventListener('click', toggleSceneList);

  // Start with the scene list open on desktop.
  if (!document.body.classList.contains('mobile')) {
    showSceneList();
  }

  // Set handler for scene switch.
  scenes.forEach(function(scene) {
    var el = document.querySelector('#sceneList .scene[data-id="' + scene.data.id + '"]');
    el.addEventListener('click', function() {
      switchScene(scene);
      // On mobile, hide scene list after selecting a scene.
      if (document.body.classList.contains('mobile')) {
        hideSceneList();
      }
    });
  });

  // DOM elements for view controls.
  var viewUpElement = document.querySelector('#viewUp');
  var viewDownElement = document.querySelector('#viewDown');
  var viewLeftElement = document.querySelector('#viewLeft');
  var viewRightElement = document.querySelector('#viewRight');
  //var viewInElement = document.querySelector('#viewIn');
  //var viewOutElement = document.querySelector('#viewOut');

  // Dynamic parameters for controls.
  var velocity = 0.7;
  var friction = 3;

  // Associate view controls with elements.
  var controls = viewer.controls();
  controls.registerMethod('upElement',    new Marzipano.ElementPressControlMethod(viewUpElement,     'y', -velocity, friction), true);
  controls.registerMethod('downElement',  new Marzipano.ElementPressControlMethod(viewDownElement,   'y',  velocity, friction), true);
  controls.registerMethod('leftElement',  new Marzipano.ElementPressControlMethod(viewLeftElement,   'x', -velocity, friction), true);
  controls.registerMethod('rightElement', new Marzipano.ElementPressControlMethod(viewRightElement,  'x',  velocity, friction), true);
  // Corrected parameter for zoom is 'fov'
  //controls.registerMethod('inElement',    new Marzipano.ElementPressControlMethod(viewInElement,  'fov', -velocity, friction), true);
  //controls.registerMethod('outElement',   new Marzipano.ElementPressControlMethod(viewOutElement, 'fov',  velocity, friction), true);

  function sanitize(s) {
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;');
  }

  // Placeholder for moveMarker function to prevent errors


  function switchScene(scene) {
    stopAutorotate();
    scene.view.setParameters(scene.data.initialViewParameters);
    scene.scene.switchTo();
    startAutorotate();
    updateSceneName(scene);
    updateSceneList(scene);
    moveMarker(scene.data.id); // This will call the placeholder function
    attachHtmlHotspots(scene.data.id, scene.scene);
  }

  function updateSceneName(scene) {
    sceneNameElement.innerHTML = sanitize(scene.data.name);
  }

  function updateSceneList(scene) {
    for (var i = 0; i < sceneElements.length; i++) {
      var el = sceneElements[i];
      if (el.getAttribute('data-id') === scene.data.id) {
        el.classList.add('current');
      } else {
        el.classList.remove('current');
      }
    }
  }

  function showSceneList() {
    sceneListElement.classList.add('enabled');
    sceneListToggleElement.classList.add('enabled');
  }

  function hideSceneList() {
    sceneListElement.classList.remove('enabled');
    sceneListToggleElement.classList.remove('enabled');
  }

  function toggleSceneList() {
    sceneListElement.classList.toggle('enabled');
    sceneListToggleElement.classList.toggle('enabled');
  }

  function startAutorotate() {
    if (!autorotateToggleElement.classList.contains('enabled')) {
      return;
    }
    viewer.startMovement(autorotate);
    viewer.setIdleMovement(3000, autorotate);
  }

  function stopAutorotate() {
    viewer.stopMovement();
    viewer.setIdleMovement(Infinity);
  }

  function toggleAutorotate() {
    if (autorotateToggleElement.classList.contains('enabled')) {
      autorotateToggleElement.classList.remove('enabled');
      stopAutorotate();
    } else {
      autorotateToggleElement.classList.add('enabled');
      startAutorotate();
    }
  }

  function createLinkHotspotElement(hotspot) {
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot', 'link-hotspot');

    var icon = document.createElement('img');
    icon.src = USE_SUPABASE ? SUPABASE_IMAGES_URL + '/link.png' : 'static/img/link.png';
    icon.classList.add('link-hotspot-icon');

    var transformProperties = [ '-ms-transform', '-webkit-transform', 'transform' ];
    for (var i = 0; i < transformProperties.length; i++) {
      var property = transformProperties[i];
      icon.style[property] = 'rotate(' + hotspot.rotation + 'rad)';
    }

    wrapper.addEventListener('click', function() {
      switchScene(findSceneById(hotspot.target));
    });

    stopTouchAndScrollEventPropagation(wrapper);

    var tooltip = document.createElement('div');
    tooltip.classList.add('hotspot-tooltip', 'link-hotspot-tooltip');
    tooltip.innerHTML = findSceneDataById(hotspot.target).name;

    wrapper.appendChild(icon);
    wrapper.appendChild(tooltip);

    return wrapper;
  }

  function createInfoHotspotElement(hotspot) {
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot', 'info-hotspot');

    var header = document.createElement('div');
    header.classList.add('info-hotspot-header');

    var iconWrapper = document.createElement('div');
    iconWrapper.classList.add('info-hotspot-icon-wrapper');
    var icon = document.createElement('img');
    var iconName = hotspot.icon ? hotspot.icon : 'info.png';
    icon.src = USE_SUPABASE ? SUPABASE_IMAGES_URL + '/' + iconName : 'static/img/' + iconName;
    icon.classList.add('info-hotspot-icon');
    iconWrapper.appendChild(icon);

    var titleWrapper = document.createElement('div');
    titleWrapper.classList.add('info-hotspot-title-wrapper');
    var title = document.createElement('div');
    title.classList.add('info-hotspot-title');
    title.innerHTML = hotspot.title;
    titleWrapper.appendChild(title);

    var closeWrapper = document.createElement('div');
    closeWrapper.classList.add('info-hotspot-close-wrapper');
    var closeIcon = document.createElement('img');
    closeIcon.src = USE_SUPABASE ? SUPABASE_IMAGES_URL + '/close.png' : 'static/img/close.png';
    closeIcon.classList.add('info-hotspot-close-icon');
    closeWrapper.appendChild(closeIcon);

    header.appendChild(iconWrapper);
    header.appendChild(titleWrapper);
    header.appendChild(closeWrapper);

    var text = document.createElement('div');
    text.classList.add('info-hotspot-text');
    text.innerHTML = hotspot.text;

    wrapper.appendChild(header);
    wrapper.appendChild(text);

    var modal = document.createElement('div');
    modal.innerHTML = wrapper.innerHTML;
    modal.classList.add('info-hotspot-modal');
    document.body.appendChild(modal);

    var toggle = function() {
      wrapper.classList.toggle('visible');
      modal.classList.toggle('visible');
    };

    wrapper.querySelector('.info-hotspot-header').addEventListener('click', toggle);
    modal.querySelector('.info-hotspot-close-wrapper').addEventListener('click', toggle);

    stopTouchAndScrollEventPropagation(wrapper);

    return wrapper;
  }

  function stopTouchAndScrollEventPropagation(element) {
    var eventList = [ 'touchstart', 'touchmove', 'touchend', 'touchcancel',
                      'wheel', 'mousewheel' ];
    for (var i = 0; i < eventList.length; i++) {
      element.addEventListener(eventList[i], function(event) {
        event.stopPropagation();
      });
    }
  }

  function findSceneById(id) {
    for (var i = 0; i < scenes.length; i++) {
      if (scenes[i].data.id === id) {
        return scenes[i];
      }
    }
    return null;
  }

  function findSceneDataById(id) {
    for (var i = 0; i < data.scenes.length; i++) {
      if (data.scenes[i].id === id) {
        return data.scenes[i];
      }
    }
    return null;
  }

  // Display the initial scene.
  switchScene(scenes[0]);

  function attachHtmlHotspots(sceneId, sceneObj) {
    document.querySelectorAll('.external-hotspot').forEach(function(el) {
      el.style.display = 'none';
    });

    var sceneHotspots = document.querySelectorAll('.external-hotspot[data-scene="' + sceneId + '"]');
    sceneHotspots.forEach(function(el) {
      el.style.display = 'block';
      var yaw = parseFloat(el.getAttribute('data-yaw'));
      var pitch = parseFloat(el.getAttribute('data-pitch'));
      sceneObj.hotspotContainer().createHotspot(el, { yaw: yaw, pitch: pitch });
    });
  }

})();