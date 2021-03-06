define([
    'plugins/plugins',
    'playlist/loader',
    'playlist/playlist',
    'utils/scriptloader',
    'utils/helpers',
    'utils/backbone.events',
    'utils/constants',
    'utils/underscore',
    'events/events'
], function(plugins, PlaylistLoader, Playlist, ScriptLoader, utils, Events, Constants, _, events) {

    var _pluginLoader,
        _playlistLoader;


    function getQueue() {

        var Components = {
            LOAD_PLUGINS : {
                method: _loadPlugins,
                depends: []
            },
            LOAD_SKIN : {
                method: _loadSkin,
                depends: []
            },
            LOAD_PLAYLIST : {
                method: _loadPlaylist,
                depends: []
            },
            SETUP_COMPONENTS : {
                method: _setupComponents,
                depends: [
                    // view controls require that a playlist item be set
                    'LOAD_PLAYLIST',
                    'LOAD_SKIN'
                ]
            },
            SEND_READY : {
                method: _sendReady,
                depends: [
                    'LOAD_PLUGINS',
                    'SETUP_COMPONENTS'
                ]
            }
        };

        return Components;
    }


    function _loadPlugins(resolve, _model, _api) {
        _pluginLoader = plugins.loadPlugins(_model.config.id, _model.config.plugins);
        _pluginLoader.on(events.COMPLETE, _.partial(_completePlugins, resolve, _model, _api));
        _pluginLoader.on(events.ERROR, _.partial(_pluginsError, resolve));
        _pluginLoader.load();
    }

    function _completePlugins(resolve, _model, _api) {
        // TODO: flatten flashPlugins and pass to flash provider
        _model.config.flashPlugins = _pluginLoader.setupPlugins(_api, _model.config, _.partial(_resizePlugin, _api));
        
        resolve();
    }

    function _resizePlugin(_api, plugin, div, onready) {
        var id = _api.id;
        return function() {
            var displayarea = document.querySelector('#' + id + ' .jw-overlays');
            if (displayarea && onready) {
                displayarea.appendChild(div);
            }
            if (typeof plugin.resize === 'function') {
                plugin.resize(displayarea.clientWidth, displayarea.clientHeight);
                setTimeout(function() {
                    plugin.resize(displayarea.clientWidth, displayarea.clientHeight);
                }, 400);
            }
            div.left = displayarea.style.left;
            div.top = displayarea.style.top;
        };
    }

    function _pluginsError(resolve, evt) {
        _error(resolve, 'Could not load plugin', evt.message);
    }

    function _loadPlaylist(resolve, _model) {
        var playlist = _model.config.playlist;
        if (_.isString(playlist)) {
            _playlistLoader = new PlaylistLoader();
            _playlistLoader.on(events.JWPLAYER_PLAYLIST_LOADED, _.partial(_completePlaylist, resolve));
            _playlistLoader.on(events.JWPLAYER_ERROR, _.partial(_playlistError, resolve));
            _playlistLoader.load(playlist);
        } else {
            _completePlaylist(resolve, _model);
        }
    }

    function _completePlaylist(resolve, _model) {
        var data = _model.config;
        var playlist = data.playlist;
        if (_.isArray(playlist)) {
            playlist = Playlist(playlist);
            _model.setPlaylist(playlist);
            if (_model.playlist.length === 0) {
                _playlistError(resolve);
                return;
            }
            resolve();
        } else {
            _error(resolve, 'Playlist type not supported', typeof playlist);
        }
    }

    function _playlistError(resolve, evt) {
        if (evt && evt.message) {
            _error(resolve, 'Error loading playlist', evt.message);
        } else {
            _error(resolve, 'Error loading player', 'No playable sources found');
        }
    }

    function skinToLoad(skin) {
        if(_.contains(Constants.Skins, skin)) {
            return utils.getSkinUrl(skin);
        } else {
            console.log('The skin parameter does not match any of our skins : ' + skin);
        }
    }

    function isSkinLoaded(skinPath) {
        var ss = document.styleSheets;
        for (var i = 0, max = ss.length; i < max; i++) {
            if (ss[i].href === skinPath) {
                return true;
            }
        }
        return false;
    }

    function _loadSkin(resolve, _model) {
        var skinName = _model.get('skin');
        var skinUrl = _model.get('skinUrl');


        if (skinName && !skinUrl) {
            // if a skin name is defined, but there is no URL, load from CDN
            skinUrl = skinToLoad(skinName);
        }

        // seven is built into the player
        if (skinName !== 'seven' && _.isString(skinUrl) && !isSkinLoaded(skinUrl)) {
            _model.set('skin-loading', true);

            var isStylesheet = true;
            var loader = new ScriptLoader(skinUrl, isStylesheet);

            loader.addEventListener(events.COMPLETE, function() {
                _model.set('skin-loading', false);
            })
                .addEventListener(events.ERROR, function() {
                    console.log('The given skin failed to load : ', skinUrl);
                    _model.set('skin', null);
                    _model.set('skin-loading', false);
                });

            loader.load();
        }

        // Control elements are hidden by the loading flag until it is ready
        _.defer(function() {
            resolve();
        });
    }

    function _setupComponents(resolve, _model, _api, _view) {
        _view.setup();
        resolve();
    }

    function _sendReady(resolve) {
        resolve({
            type : 'complete'
        });
    }

    function _error(resolve, msg, reason) {
        resolve({
            type : 'error',
            msg : msg,
            reason : reason
        });
    }

    return {
        getQueue : getQueue
    };
});