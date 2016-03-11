
/*
    X-Wing Squad Builder
    Geordan Rosario <geordan@gmail.com>
    https://github.com/geordanr/xwing
 */
var DFL_LANGUAGE, GenericAddon, SERIALIZATION_CODE_TO_CLASS, SPEC_URL, SQUAD_DISPLAY_NAME_MAX_LENGTH, Ship, TYPES, builders, byName, byPoints, exportObj, getPrimaryFaction, sortWithoutQuotes, statAndEffectiveStat, _base,
  __slice = [].slice,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

window.iced = {
  Deferrals: (function() {
    function _Class(_arg) {
      this.continuation = _arg;
      this.count = 1;
      this.ret = null;
    }

    _Class.prototype._fulfill = function() {
      if (!--this.count) {
        return this.continuation(this.ret);
      }
    };

    _Class.prototype.defer = function(defer_params) {
      ++this.count;
      return (function(_this) {
        return function() {
          var inner_params, _ref;
          inner_params = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
          if (defer_params != null) {
            if ((_ref = defer_params.assign_fn) != null) {
              _ref.apply(null, inner_params);
            }
          }
          return _this._fulfill();
        };
      })(this);
    };

    return _Class;

  })(),
  findDeferral: function() {
    return null;
  },
  trampoline: function(_fn) {
    return _fn();
  }
};
window.__iced_k = window.__iced_k_noop = function() {};

exportObj = typeof exports !== "undefined" && exports !== null ? exports : this;

exportObj.SquadBuilderBackend = (function() {

  /*
      Usage:
  
          rebel_builder = new SquadBuilder
              faction: 'Rebel Alliance'
              ...
          empire_builder = new SquadBuilder
              faction: 'Galactic Empire'
              ...
          backend = new SquadBuilderBackend
              server: 'https://xwing.example.com'
              builders: [ rebel_builder, empire_builder ]
              login_logout_button: '#login-logout'
              auth_status: '#auth-status'
   */
  function SquadBuilderBackend(args) {
    this.getLanguagePreference = __bind(this.getLanguagePreference, this);
    this.nameCheck = __bind(this.nameCheck, this);
    this.maybeAuthenticationChanged = __bind(this.maybeAuthenticationChanged, this);
    var builder, _i, _len, _ref;
    $.ajaxSetup({
      dataType: "json",
      xhrFields: {
        withCredentials: true
      }
    });
    this.server = args.server;
    this.builders = args.builders;
    this.login_logout_button = $(args.login_logout_button);
    this.auth_status = $(args.auth_status);
    this.authenticated = false;
    this.ui_ready = false;
    this.oauth_window = null;
    this.method_metadata = {
      google_oauth2: {
        icon: 'icon-google-plus-sign',
        text: 'Google'
      },
      facebook: {
        icon: 'icon-facebook-sign',
        text: 'Facebook'
      },
      twitter: {
        icon: 'icon-twitter-sign',
        text: 'Twitter'
      }
    };
    this.squad_display_mode = 'all';
    this.collection_save_timer = null;
    this.setupHandlers();
    this.setupUI();
    this.authenticate((function(_this) {
      return function() {
        _this.auth_status.hide();
        return _this.login_logout_button.removeClass('hidden');
      };
    })(this));
    _ref = this.builders;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      builder = _ref[_i];
      builder.setBackend(this);
    }
    this.updateAuthenticationVisibility();
  }

  SquadBuilderBackend.prototype.updateAuthenticationVisibility = function() {
    if (this.authenticated) {
      $('.show-authenticated').show();
      return $('.hide-authenticated').hide();
    } else {
      $('.show-authenticated').hide();
      return $('.hide-authenticated').show();
    }
  };

  SquadBuilderBackend.prototype.save = function(serialized, id, name, faction, additional_data, cb) {
    var post_args, post_url;
    if (id == null) {
      id = null;
    }
    if (additional_data == null) {
      additional_data = {};
    }
    if (serialized === "") {
      return cb({
        id: null,
        success: false,
        error: "You cannot save an empty squad"
      });
    } else if ($.trim(name) === "") {
      return cb({
        id: null,
        success: false,
        error: "Squad name cannot be empty"
      });
    } else if ((faction == null) || faction === "") {
      throw "Faction unspecified to save()";
    } else {
      post_args = {
        name: $.trim(name),
        faction: $.trim(faction),
        serialized: serialized,
        additional_data: additional_data
      };
      if (id != null) {
        post_url = "" + this.server + "/squads/" + id;
      } else {
        post_url = "" + this.server + "/squads/new";
        post_args['_method'] = 'put';
      }
      return $.post(post_url, post_args, (function(_this) {
        return function(data, textStatus, jqXHR) {
          return cb({
            id: data.id,
            success: data.success,
            error: data.error
          });
        };
      })(this));
    }
  };

  SquadBuilderBackend.prototype["delete"] = function(id, cb) {
    var post_args;
    post_args = {
      '_method': 'delete'
    };
    return $.post("" + this.server + "/squads/" + id, post_args, (function(_this) {
      return function(data, textStatus, jqXHR) {
        return cb({
          success: data.success,
          error: data.error
        });
      };
    })(this));
  };

  SquadBuilderBackend.prototype.list = function(builder, all) {
    var list_ul, loading_pane, url;
    if (all == null) {
      all = false;
    }
    if (all) {
      this.squad_list_modal.find('.modal-header .squad-list-header-placeholder').text("Everyone's " + builder.faction + " Squads");
    } else {
      this.squad_list_modal.find('.modal-header .squad-list-header-placeholder').text("Your " + builder.faction + " Squads");
    }
    list_ul = $(this.squad_list_modal.find('ul.squad-list'));
    list_ul.text('');
    list_ul.hide();
    loading_pane = $(this.squad_list_modal.find('p.squad-list-loading'));
    loading_pane.show();
    this.show_all_squads_button.click();
    this.squad_list_modal.modal('show');
    url = all ? "" + this.server + "/all" : "" + this.server + "/squads/list";
    return $.get(url, (function(_this) {
      return function(data, textStatus, jqXHR) {
        var li, squad, _i, _len, _ref;
        if (data[builder.faction].length === 0) {
          list_ul.append($.trim("<li>You have no squads saved.  Go save one!</li>"));
        } else {
          _ref = data[builder.faction];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            squad = _ref[_i];
            li = $(document.createElement('LI'));
            li.addClass('squad-summary');
            li.data('squad', squad);
            li.data('builder', builder);
            list_ul.append(li);
            li.append($.trim("<div class=\"row-fluid\">\n    <div class=\"span9\">\n        <h4>" + squad.name + "</h4>\n    </div>\n    <div class=\"span3\">\n        <h5>" + squad.additional_data.points + " Points</h5>\n    </div>\n</div>\n<div class=\"row-fluid\">\n    <div class=\"span10\">\n        " + squad.additional_data.description + "\n    </div>\n    <div class=\"span2\">\n        <button class=\"btn load-squad\">Load</button>\n    </div>\n</div>"));
            li.click(function(e) {
              var button;
              e.preventDefault();
              button = $(e.target);
              li = button.closest('li');
              builder = li.data('builder');
              _this.squad_list_modal.modal('hide');
              if (builder.current_squad.dirty) {
                return _this.warnUnsaved(builder, function() {
                  return builder.container.trigger('xwing-backend:squadLoadRequested', li.data('squad'));
                });
              } else {
                return builder.container.trigger('xwing-backend:squadLoadRequested', li.data('squad'));
              }
            });
          }
        }
        loading_pane.fadeOut('fast');
        return list_ul.fadeIn('fast');
      };
    })(this));
  };

  SquadBuilderBackend.prototype.authenticate = function(cb) {
    var old_auth_state;
    if (cb == null) {
      cb = $.noop;
    }
    $(this.auth_status.find('.payload')).text('Checking auth status...');
    this.auth_status.show();
    old_auth_state = this.authenticated;
    return $.ajax({
      url: "" + this.server + "/ping",
      success: (function(_this) {
        return function(data) {
          if (data != null ? data.success : void 0) {
            _this.authenticated = true;
          } else {
            _this.authenticated = false;
          }
          return _this.maybeAuthenticationChanged(old_auth_state, cb);
        };
      })(this),
      error: (function(_this) {
        return function(jqXHR, textStatus, errorThrown) {
          _this.authenticated = false;
          return _this.maybeAuthenticationChanged(old_auth_state, cb);
        };
      })(this)
    });
  };

  SquadBuilderBackend.prototype.maybeAuthenticationChanged = function(old_auth_state, cb) {
    if (old_auth_state !== this.authenticated) {
      $(window).trigger('xwing-backend:authenticationChanged', [this.authenticated, this]);
    }
    this.oauth_window = null;
    this.auth_status.hide();
    cb(this.authenticated);
    return this.authenticated;
  };

  SquadBuilderBackend.prototype.login = function() {
    if (this.ui_ready) {
      return this.login_modal.modal('show');
    }
  };

  SquadBuilderBackend.prototype.logout = function(cb) {
    if (cb == null) {
      cb = $.noop;
    }
    $(this.auth_status.find('.payload')).text('Logging out...');
    this.auth_status.show();
    return $.get("" + this.server + "/auth/logout", (function(_this) {
      return function(data, textStatus, jqXHR) {
        _this.authenticated = false;
        $(window).trigger('xwing-backend:authenticationChanged', [_this.authenticated, _this]);
        _this.auth_status.hide();
        return cb();
      };
    })(this));
  };

  SquadBuilderBackend.prototype.showSaveAsModal = function(builder) {
    this.save_as_modal.data('builder', builder);
    this.save_as_input.val(builder.current_squad.name);
    this.save_as_save_button.addClass('disabled');
    this.nameCheck();
    return this.save_as_modal.modal('show');
  };

  SquadBuilderBackend.prototype.showDeleteModal = function(builder) {
    this.delete_modal.data('builder', builder);
    this.delete_name_container.text(builder.current_squad.name);
    return this.delete_modal.modal('show');
  };

  SquadBuilderBackend.prototype.nameCheck = function() {
    var name;
    window.clearInterval(this.save_as_modal.data('timer'));
    name = $.trim(this.save_as_input.val());
    if (name.length === 0) {
      this.name_availability_container.text('');
      return this.name_availability_container.append($.trim("<i class=\"icon-thumbs-down\"> A name is required"));
    } else {
      return $.post("" + this.server + "/squads/namecheck", {
        name: name
      }, (function(_this) {
        return function(data) {
          _this.name_availability_container.text('');
          if (data.available) {
            _this.name_availability_container.append($.trim("<i class=\"icon-thumbs-up\"> Name is available"));
            return _this.save_as_save_button.removeClass('disabled');
          } else {
            _this.name_availability_container.append($.trim("<i class=\"icon-thumbs-down\"> You already have a squad with that name"));
            return _this.save_as_save_button.addClass('disabled');
          }
        };
      })(this));
    }
  };

  SquadBuilderBackend.prototype.warnUnsaved = function(builder, action) {
    this.unsaved_modal.data('builder', builder);
    this.unsaved_modal.data('callback', action);
    return this.unsaved_modal.modal('show');
  };

  SquadBuilderBackend.prototype.setupUI = function() {
    var oauth_explanation;
    this.auth_status.addClass('disabled');
    this.auth_status.click((function(_this) {
      return function(e) {
        return false;
      };
    })(this));
    this.login_modal = $(document.createElement('DIV'));
    this.login_modal.addClass('modal hide fade hidden-print');
    $(document.body).append(this.login_modal);
    this.login_modal.append($.trim("<div class=\"modal-header\">\n    <button type=\"button\" class=\"close\" data-dismiss=\"modal\" aria-hidden=\"true\">&times;</button>\n    <h3>Log in with OAuth</h3>\n</div>\n<div class=\"modal-body\">\n    <p>\n        Select one of the OAuth providers below to log in and start saving squads.\n        <a class=\"login-help\" href=\"#\">What's this?</a>\n    </p>\n    <div class=\"well well-small oauth-explanation\">\n        <p>\n            <a href=\"http://en.wikipedia.org/wiki/OAuth\" target=\"_blank\">OAuth</a> is an authorization system which lets you prove your identity at a web site without having to create a new account.  Instead, you tell some provider with whom you already have an account (e.g. Google or Facebook) to prove to this web site that you say who you are.  That way, the next time you visit, this site remembers that you're that user from Google.\n        </p>\n        <p>\n            The best part about this is that you don't have to come up with a new username and password to remember.  And don't worry, I'm not collecting any data from the providers about you.  I've tried to set the scope of data to be as small as possible, but some places send a bunch of data at minimum.  I throw it away.  All I look at is a unique identifier (usually some giant number).\n        </p>\n        <p>\n            For more information, check out this <a href=\"http://hueniverse.com/oauth/guide/intro/\" target=\"_blank\">introduction to OAuth</a>.\n        </p>\n        <button class=\"btn\">Got it!</button>\n    </div>\n    <ul class=\"login-providers inline\"></ul>\n    <p>\n        This will open a new window to let you authenticate with the chosen provider.  You may have to allow pop ups for this site.  (Sorry.)\n    </p>\n    <p class=\"login-in-progress\">\n        <em>OAuth login is in progress.  Please finish authorization at the specified provider using the window that was just created.</em>\n    </p>\n</div>\n<div class=\"modal-footer\">\n    <button class=\"btn\" data-dismiss=\"modal\" aria-hidden=\"true\">Close</button>\n</div>"));
    oauth_explanation = $(this.login_modal.find('.oauth-explanation'));
    oauth_explanation.hide();
    this.login_modal.find('.login-in-progress').hide();
    this.login_modal.find('a.login-help').click((function(_this) {
      return function(e) {
        e.preventDefault();
        if (!oauth_explanation.is(':visible')) {
          return oauth_explanation.slideDown('fast');
        }
      };
    })(this));
    oauth_explanation.find('button').click((function(_this) {
      return function(e) {
        e.preventDefault();
        return oauth_explanation.slideUp('fast');
      };
    })(this));
    $.get("" + this.server + "/methods", (function(_this) {
      return function(data, textStatus, jqXHR) {
        var a, li, method, methods_ul, _i, _len, _ref;
        methods_ul = $(_this.login_modal.find('ul.login-providers'));
        _ref = data.methods;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          method = _ref[_i];
          a = $(document.createElement('A'));
          a.addClass('btn btn-inverse');
          a.data('url', "" + _this.server + "/auth/" + method);
          a.append("<i class=\"" + _this.method_metadata[method].icon + "\"></i>&nbsp;" + _this.method_metadata[method].text);
          a.click(function(e) {
            e.preventDefault();
            methods_ul.slideUp('fast');
            _this.login_modal.find('.login-in-progress').slideDown('fast');
            return _this.oauth_window = window.open($(e.target).data('url'), "xwing_login");
          });
          li = $(document.createElement('LI'));
          li.append(a);
          methods_ul.append(li);
        }
        return _this.ui_ready = true;
      };
    })(this));
    this.squad_list_modal = $(document.createElement('DIV'));
    this.squad_list_modal.addClass('modal hide fade hidden-print squad-list');
    $(document.body).append(this.squad_list_modal);
    this.squad_list_modal.append($.trim("<div class=\"modal-header\">\n    <button type=\"button\" class=\"close\" data-dismiss=\"modal\" aria-hidden=\"true\">&times;</button>\n    <h3 class=\"squad-list-header-placeholder hidden-phone hidden-tablet\"></h3>\n    <h4 class=\"squad-list-header-placeholder hidden-desktop\"></h4>\n</div>\n<div class=\"modal-body\">\n    <ul class=\"squad-list\"></ul>\n    <p class=\"pagination-centered squad-list-loading\">\n        <i class=\"icon-spinner icon-spin icon-3x\"></i>\n        <br />\n        Fetching squads...\n    </p>\n</div>\n<div class=\"modal-footer\">\n    <div class=\"btn-group squad-display-mode\">\n        <button class=\"btn btn-inverse show-all-squads\">All</button>\n        <button class=\"btn show-standard-squads\">Standard</button>\n        <button class=\"btn show-epic-squads\">Epic</button>\n        <button class=\"btn show-team-epic-squads\">Team<span class=\"hidden-phone\"> Epic</span></button>\n    </div>\n    <button class=\"btn\" data-dismiss=\"modal\" aria-hidden=\"true\">Close</button>\n</div>"));
    this.squad_list_modal.find('ul.squad-list').hide();
    this.show_all_squads_button = $(this.squad_list_modal.find('.show-all-squads'));
    this.show_all_squads_button.click((function(_this) {
      return function(e) {
        if (_this.squad_display_mode !== 'all') {
          _this.squad_display_mode = 'all';
          _this.squad_list_modal.find('.squad-display-mode .btn').removeClass('btn-inverse');
          _this.show_all_squads_button.addClass('btn-inverse');
          return _this.squad_list_modal.find('.squad-list li').show();
        }
      };
    })(this));
    this.show_standard_squads_button = $(this.squad_list_modal.find('.show-standard-squads'));
    this.show_standard_squads_button.click((function(_this) {
      return function(e) {
        if (_this.squad_display_mode !== 'standard') {
          _this.squad_display_mode = 'standard';
          _this.squad_list_modal.find('.squad-display-mode .btn').removeClass('btn-inverse');
          _this.show_standard_squads_button.addClass('btn-inverse');
          return _this.squad_list_modal.find('.squad-list li').each(function(idx, elem) {
            return $(elem).toggle(($(elem).data().squad.serialized.indexOf('v3!e') === -1) && ($(elem).data().squad.serialized.indexOf('v3!t') === -1));
          });
        }
      };
    })(this));
    this.show_epic_squads_button = $(this.squad_list_modal.find('.show-epic-squads'));
    this.show_epic_squads_button.click((function(_this) {
      return function(e) {
        if (_this.squad_display_mode !== 'epic') {
          _this.squad_display_mode = 'epic';
          _this.squad_list_modal.find('.squad-display-mode .btn').removeClass('btn-inverse');
          _this.show_epic_squads_button.addClass('btn-inverse');
          return _this.squad_list_modal.find('.squad-list li').each(function(idx, elem) {
            return $(elem).toggle($(elem).data().squad.serialized.indexOf('v3!e') !== -1);
          });
        }
      };
    })(this));
    this.show_team_epic_squads_button = $(this.squad_list_modal.find('.show-team-epic-squads'));
    this.show_team_epic_squads_button.click((function(_this) {
      return function(e) {
        if (_this.squad_display_mode !== 'team-epic') {
          _this.squad_display_mode = 'team-epic';
          _this.squad_list_modal.find('.squad-display-mode .btn').removeClass('btn-inverse');
          _this.show_team_epic_squads_button.addClass('btn-inverse');
          return _this.squad_list_modal.find('.squad-list li').each(function(idx, elem) {
            return $(elem).toggle($(elem).data().squad.serialized.indexOf('v3!t') !== -1);
          });
        }
      };
    })(this));
    this.save_as_modal = $(document.createElement('DIV'));
    this.save_as_modal.addClass('modal hide fade hidden-print');
    $(document.body).append(this.save_as_modal);
    this.save_as_modal.append($.trim("<div class=\"modal-header\">\n    <button type=\"button\" class=\"close\" data-dismiss=\"modal\" aria-hidden=\"true\">&times;</button>\n    <h3>Save Squad As...</h3>\n</div>\n<div class=\"modal-body\">\n    <label for=\"xw-be-squad-save-as\">\n        New Squad Name\n        <input id=\"xw-be-squad-save-as\"></input>\n    </label>\n    <span class=\"name-availability\"></span>\n</div>\n<div class=\"modal-footer\">\n    <button class=\"btn btn-primary save\" aria-hidden=\"true\">Save</button>\n    <button class=\"btn\" data-dismiss=\"modal\" aria-hidden=\"true\">Close</button>\n</div>"));
    this.save_as_modal.on('shown', (function(_this) {
      return function() {
        return window.setTimeout(function() {
          _this.save_as_input.focus();
          return _this.save_as_input.select();
        }, 100);
      };
    })(this));
    this.save_as_save_button = this.save_as_modal.find('button.save');
    this.save_as_save_button.click((function(_this) {
      return function(e) {
        var additional_data, builder, new_name, timer;
        e.preventDefault();
        if (!_this.save_as_save_button.hasClass('disabled')) {
          timer = _this.save_as_modal.data('timer');
          if (timer != null) {
            window.clearInterval(timer);
          }
          _this.save_as_modal.modal('hide');
          builder = _this.save_as_modal.data('builder');
          additional_data = {
            points: builder.total_points,
            description: builder.describeSquad(),
            cards: builder.listCards(),
            notes: builder.getNotes()
          };
          builder.backend_save_list_as_button.addClass('disabled');
          builder.backend_status.html($.trim("<i class=\"icon-refresh icon-spin\"></i>&nbsp;Saving squad..."));
          builder.backend_status.show();
          new_name = $.trim(_this.save_as_input.val());
          return _this.save(builder.serialize(), null, new_name, builder.faction, additional_data, function(results) {
            if (results.success) {
              builder.current_squad.id = results.id;
              builder.current_squad.name = new_name;
              builder.current_squad.dirty = false;
              builder.container.trigger('xwing-backend:squadDirtinessChanged');
              builder.container.trigger('xwing-backend:squadNameChanged');
              builder.backend_status.html($.trim("<i class=\"icon-ok\"></i>&nbsp;New squad saved successfully."));
            } else {
              builder.backend_status.html($.trim("<i class=\"icon-exclamation-sign\"></i>&nbsp;" + results.error));
            }
            return builder.backend_save_list_as_button.removeClass('disabled');
          });
        }
      };
    })(this));
    this.save_as_input = $(this.save_as_modal.find('input'));
    this.save_as_input.keypress((function(_this) {
      return function(e) {
        var timer;
        if (e.which === 13) {
          _this.save_as_save_button.click();
          return false;
        } else {
          _this.name_availability_container.text('');
          _this.name_availability_container.append($.trim("<i class=\"icon-spin icon-spinner\"></i> Checking name availability..."));
          timer = _this.save_as_modal.data('timer');
          if (timer != null) {
            window.clearInterval(timer);
          }
          return _this.save_as_modal.data('timer', window.setInterval(_this.nameCheck, 500));
        }
      };
    })(this));
    this.name_availability_container = $(this.save_as_modal.find('.name-availability'));
    this.delete_modal = $(document.createElement('DIV'));
    this.delete_modal.addClass('modal hide fade hidden-print');
    $(document.body).append(this.delete_modal);
    this.delete_modal.append($.trim("<div class=\"modal-header\">\n    <button type=\"button\" class=\"close\" data-dismiss=\"modal\" aria-hidden=\"true\">&times;</button>\n    <h3>Really Delete <span class=\"squad-name-placeholder\"></span>?</h3>\n</div>\n<div class=\"modal-body\">\n    <p>Are you sure you want to delete this squad?</p>\n</div>\n<div class=\"modal-footer\">\n    <button class=\"btn btn-danger delete\" aria-hidden=\"true\">Yes, Delete <i class=\"squad-name-placeholder\"></i></button>\n    <button class=\"btn\" data-dismiss=\"modal\" aria-hidden=\"true\">Never Mind</button>\n</div>"));
    this.delete_name_container = $(this.delete_modal.find('.squad-name-placeholder'));
    this.delete_button = $(this.delete_modal.find('button.delete'));
    this.delete_button.click((function(_this) {
      return function(e) {
        var builder;
        e.preventDefault();
        builder = _this.delete_modal.data('builder');
        builder.backend_status.html($.trim("<i class=\"icon-refresh icon-spin\"></i>&nbsp;Deleting squad..."));
        builder.backend_status.show();
        builder.backend_delete_list_button.addClass('disabled');
        _this.delete_modal.modal('hide');
        return _this["delete"](builder.current_squad.id, function(results) {
          if (results.success) {
            builder.resetCurrentSquad();
            builder.current_squad.dirty = true;
            builder.container.trigger('xwing-backend:squadDirtinessChanged');
            return builder.backend_status.html($.trim("<i class=\"icon-ok\"></i>&nbsp;Squad deleted."));
          } else {
            builder.backend_status.html($.trim("<i class=\"icon-exclamation-sign\"></i>&nbsp;" + results.error));
            return builder.backend_delete_list_button.removeClass('disabled');
          }
        });
      };
    })(this));
    this.unsaved_modal = $(document.createElement('DIV'));
    this.unsaved_modal.addClass('modal hide fade hidden-print');
    $(document.body).append(this.unsaved_modal);
    this.unsaved_modal.append($.trim("<div class=\"modal-header\">\n    <button type=\"button\" class=\"close\" data-dismiss=\"modal\" aria-hidden=\"true\">&times;</button>\n    <h3>Unsaved Changes</h3>\n</div>\n<div class=\"modal-body\">\n    <p>You have not saved changes to this squad.  Do you want to go back and save?</p>\n</div>\n<div class=\"modal-footer\">\n    <button class=\"btn btn-primary\" aria-hidden=\"true\" data-dismiss=\"modal\">Go Back</button>\n    <button class=\"btn btn-danger discard\" aria-hidden=\"true\">Discard Changes</button>\n</div>"));
    this.unsaved_discard_button = $(this.unsaved_modal.find('button.discard'));
    return this.unsaved_discard_button.click((function(_this) {
      return function(e) {
        e.preventDefault();
        _this.unsaved_modal.data('builder').current_squad.dirty = false;
        _this.unsaved_modal.data('callback')();
        return _this.unsaved_modal.modal('hide');
      };
    })(this));
  };

  SquadBuilderBackend.prototype.setupHandlers = function() {
    $(window).on('xwing-backend:authenticationChanged', (function(_this) {
      return function(e, authenticated, backend) {
        _this.updateAuthenticationVisibility();
        if (authenticated) {
          return _this.loadCollection();
        }
      };
    })(this));
    this.login_logout_button.click((function(_this) {
      return function(e) {
        e.preventDefault();
        if (_this.authenticated) {
          return _this.logout();
        } else {
          return _this.login();
        }
      };
    })(this));
    return $(window).on('message', (function(_this) {
      return function(e) {
        var ev, _ref, _ref1;
        ev = e.originalEvent;
        if (ev.origin === _this.server) {
          switch ((_ref = ev.data) != null ? _ref.command : void 0) {
            case 'auth_successful':
              _this.authenticate();
              _this.login_modal.modal('hide');
              _this.login_modal.find('.login-in-progress').hide();
              _this.login_modal.find('ul.login-providers').show();
              return ev.source.close();
            default:
              return console.log("Unexpected command " + ((_ref1 = ev.data) != null ? _ref1.command : void 0));
          }
        } else {
          console.log("Message received from unapproved origin " + ev.origin);
          return window.last_ev = e;
        }
      };
    })(this)).on('xwing-collection:changed', (function(_this) {
      return function(e, collection) {
        if (_this.collection_save_timer != null) {
          clearTimeout(_this.collection_save_timer);
        }
        return _this.collection_save_timer = setTimeout(function() {
          return _this.saveCollection(collection, function(res) {
            if (res) {
              return $(window).trigger('xwing-collection:saved', collection);
            }
          });
        }, 1000);
      };
    })(this));
  };

  SquadBuilderBackend.prototype.getSettings = function(cb) {
    if (cb == null) {
      cb = $.noop;
    }
    return $.get("" + this.server + "/settings").done((function(_this) {
      return function(data, textStatus, jqXHR) {
        return cb(data.settings);
      };
    })(this));
  };

  SquadBuilderBackend.prototype.set = function(setting, value, cb) {
    var post_args;
    if (cb == null) {
      cb = $.noop;
    }
    post_args = {
      "_method": "PUT"
    };
    post_args[setting] = value;
    return $.post("" + this.server + "/settings", post_args).done((function(_this) {
      return function(data, textStatus, jqXHR) {
        return cb(data.set);
      };
    })(this));
  };

  SquadBuilderBackend.prototype.deleteSetting = function(setting, cb) {
    if (cb == null) {
      cb = $.noop;
    }
    return $.post("" + this.server + "/settings/" + setting, {
      "_method": "DELETE"
    }).done((function(_this) {
      return function(data, textStatus, jqXHR) {
        return cb(data.deleted);
      };
    })(this));
  };

  SquadBuilderBackend.prototype.getHeaders = function(cb) {
    if (cb == null) {
      cb = $.noop;
    }
    return $.get("" + this.server + "/headers").done((function(_this) {
      return function(data, textStatus, jqXHR) {
        return cb(data.headers);
      };
    })(this));
  };

  SquadBuilderBackend.prototype.getLanguagePreference = function(settings, cb) {
    var headers, language_code, language_range, language_tag, quality, ___iced_passed_deferral, __iced_deferrals, __iced_k;
    __iced_k = __iced_k_noop;
    ___iced_passed_deferral = iced.findDeferral(arguments);
    if (cb == null) {
      cb = $.noop;
    }
    if ((settings != null ? settings.language : void 0) != null) {
      return __iced_k(cb(settings.language));
    } else {
      (function(_this) {
        return (function(__iced_k) {
          __iced_deferrals = new iced.Deferrals(__iced_k, {
            parent: ___iced_passed_deferral,
            funcname: "SquadBuilderBackend.getLanguagePreference"
          });
          _this.getHeaders(__iced_deferrals.defer({
            assign_fn: (function() {
              return function() {
                return headers = arguments[0];
              };
            })(),
            lineno: 592
          }));
          __iced_deferrals._fulfill();
        });
      })(this)((function(_this) {
        return function() {
          var _i, _len, _ref, _ref1, _ref2;
          if ((typeof headers !== "undefined" && headers !== null ? headers.HTTP_ACCEPT_LANGUAGE : void 0) != null) {
            _ref = headers.HTTP_ACCEPT_LANGUAGE.split(',');
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              language_range = _ref[_i];
              _ref1 = language_range.split(';'), language_tag = _ref1[0], quality = _ref1[1];
              if (language_tag === '*') {
                cb('English');
              } else {
                language_code = language_tag.split('-')[0];
                cb((_ref2 = exportObj.codeToLanguage[language_code]) != null ? _ref2 : 'English');
              }
              break;
            }
          } else {
            cb('English');
          }
          return __iced_k();
        };
      })(this));
    }
  };

  SquadBuilderBackend.prototype.saveCollection = function(collection, cb) {
    var post_args;
    if (cb == null) {
      cb = $.noop;
    }
    post_args = {
      expansions: collection.expansions,
      singletons: collection.singletons
    };
    return $.post("" + this.server + "/collection", post_args).done(function(data, textStatus, jqXHR) {
      return cb(data.success);
    });
  };

  SquadBuilderBackend.prototype.loadCollection = function() {
    return $.get("" + this.server + "/collection").done(function(data, textStatus, jqXHR) {
      var collection;
      collection = data.collection;
      return new exportObj.Collection({
        expansions: collection.expansions,
        singletons: collection.singletons
      });
    });
  };

  return SquadBuilderBackend;

})();


/*
    X-Wing Card Browser
    Geordan Rosario <geordan@gmail.com>
    https://github.com/geordanr/xwing
 */

exportObj = typeof exports !== "undefined" && exports !== null ? exports : this;

TYPES = ['pilots', 'upgrades', 'modifications', 'titles'];

byName = function(a, b) {
  var a_name, b_name;
  a_name = a.name.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
  b_name = b.name.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
  if (a_name < b_name) {
    return -1;
  } else if (b_name < a_name) {
    return 1;
  } else {
    return 0;
  }
};

byPoints = function(a, b) {
  if (a.data.points < b.data.points) {
    return -1;
  } else if (b.data.points < a.data.points) {
    return 1;
  } else {
    return byName(a, b);
  }
};

String.prototype.capitalize = function() {
  return this.charAt(0).toUpperCase() + this.slice(1);
};

exportObj.CardBrowser = (function() {
  function CardBrowser(args) {
    this.container = $(args.container);
    this.currently_selected = null;
    this.language = 'English';
    this.prepareData();
    this.setupUI();
    this.setupHandlers();
    this.sort_selector.change();
  }

  CardBrowser.prototype.setupUI = function() {
    this.container.append($.trim("<div class=\"container-fluid xwing-card-browser\">\n    <div class=\"row-fluid\">\n        <div class=\"span12\">\n            <span class=\"translate sort-cards-by\">Sort cards by</span>: <select class=\"sort-by\">\n                <option value=\"name\">Name</option>\n                <option value=\"source\">Source</option>\n                <option value=\"type-by-points\">Type (by Points)</option>\n                <option value=\"type-by-name\" selected=\"1\">Type (by Name)</option>\n            </select>\n        </div>\n    </div>\n    <div class=\"row-fluid\">\n        <div class=\"span4 card-selector-container\">\n\n        </div>\n        <div class=\"span8\">\n            <div class=\"well card-viewer-placeholder info-well\">\n                <p class=\"translate select-a-card\">Select a card from the list at the left.</p>\n            </div>\n            <div class=\"well card-viewer-container info-well\">\n                <span class=\"info-name\"></span>\n                <br />\n                <span class=\"info-type\"></span>\n                <br />\n                <span class=\"info-sources\"></span>\n                <table>\n                    <tbody>\n                        <tr class=\"info-skill\">\n                            <td class=\"info-header\">Skill</td>\n                            <td class=\"info-data info-skill\"></td>\n                        </tr>\n                        <tr class=\"info-energy\">\n                            <td class=\"info-header\"><i class=\"xwing-miniatures-font xwing-miniatures-font-energy\"></i></td>\n                            <td class=\"info-data info-energy\"></td>\n                        </tr>\n                        <tr class=\"info-attack\">\n                            <td class=\"info-header\"><i class=\"xwing-miniatures-font xwing-miniatures-font-attack\"></i></td>\n                            <td class=\"info-data info-attack\"></td>\n                        </tr>\n                        <tr class=\"info-range\">\n                            <td class=\"info-header\">Range</td>\n                            <td class=\"info-data info-range\"></td>\n                        </tr>\n                        <tr class=\"info-agility\">\n                            <td class=\"info-header\"><i class=\"xwing-miniatures-font xwing-miniatures-font-agility\"></i></td>\n                            <td class=\"info-data info-agility\"></td>\n                        </tr>\n                        <tr class=\"info-hull\">\n                            <td class=\"info-header\"><i class=\"xwing-miniatures-font xwing-miniatures-font-hull\"></i></td>\n                            <td class=\"info-data info-hull\"></td>\n                        </tr>\n                        <tr class=\"info-shields\">\n                            <td class=\"info-header\"><i class=\"xwing-miniatures-font xwing-miniatures-font-shield\"></i></td>\n                            <td class=\"info-data info-shields\"></td>\n                        </tr>\n                        <tr class=\"info-actions\">\n                            <td class=\"info-header\">Actions</td>\n                            <td class=\"info-data\"></td>\n                        </tr>\n                        <tr class=\"info-upgrades\">\n                            <td class=\"info-header\">Upgrades</td>\n                            <td class=\"info-data\"></td>\n                        </tr>\n                    </tbody>\n                </table>\n                <p class=\"info-text\" />\n            </div>\n        </div>\n    </div>\n</div>"));
    this.card_selector_container = $(this.container.find('.xwing-card-browser .card-selector-container'));
    this.card_viewer_container = $(this.container.find('.xwing-card-browser .card-viewer-container'));
    this.card_viewer_container.hide();
    this.card_viewer_placeholder = $(this.container.find('.xwing-card-browser .card-viewer-placeholder'));
    this.sort_selector = $(this.container.find('select.sort-by'));
    return this.sort_selector.select2({
      minimumResultsForSearch: -1
    });
  };

  CardBrowser.prototype.setupHandlers = function() {
    this.sort_selector.change((function(_this) {
      return function(e) {
        return _this.renderList(_this.sort_selector.val());
      };
    })(this));
    return $(window).on('xwing:afterLanguageLoad', (function(_this) {
      return function(e, language, cb) {
        if (cb == null) {
          cb = $.noop;
        }
        _this.language = language;
        _this.prepareData();
        return _this.renderList(_this.sort_selector.val());
      };
    })(this));
  };

  CardBrowser.prototype.prepareData = function() {
    var card, card_data, card_name, sorted_sources, sorted_types, source, type, upgrade_text, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _len5, _m, _n, _ref, _ref1, _ref2, _results;
    this.all_cards = [];
    for (_i = 0, _len = TYPES.length; _i < _len; _i++) {
      type = TYPES[_i];
      if (type === 'upgrades') {
        this.all_cards = this.all_cards.concat((function() {
          var _ref, _results;
          _ref = exportObj[type];
          _results = [];
          for (card_name in _ref) {
            card_data = _ref[card_name];
            _results.push({
              name: card_data.name,
              type: exportObj.translate(this.language, 'ui', 'upgradeHeader', card_data.slot),
              data: card_data,
              orig_type: card_data.slot
            });
          }
          return _results;
        }).call(this));
      } else {
        this.all_cards = this.all_cards.concat((function() {
          var _ref, _results;
          _ref = exportObj[type];
          _results = [];
          for (card_name in _ref) {
            card_data = _ref[card_name];
            _results.push({
              name: card_data.name,
              type: exportObj.translate(this.language, 'singular', type),
              data: card_data,
              orig_type: exportObj.translate('English', 'singular', type)
            });
          }
          return _results;
        }).call(this));
      }
    }
    this.types = (function() {
      var _j, _len1, _ref, _results;
      _ref = ['Pilot', 'Modification', 'Title'];
      _results = [];
      for (_j = 0, _len1 = _ref.length; _j < _len1; _j++) {
        type = _ref[_j];
        _results.push(exportObj.translate(this.language, 'types', type));
      }
      return _results;
    }).call(this);
    _ref = exportObj.upgrades;
    for (card_name in _ref) {
      card_data = _ref[card_name];
      upgrade_text = exportObj.translate(this.language, 'ui', 'upgradeHeader', card_data.slot);
      if (__indexOf.call(this.types, upgrade_text) < 0) {
        this.types.push(upgrade_text);
      }
    }
    this.all_cards.sort(byName);
    this.sources = [];
    _ref1 = this.all_cards;
    for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
      card = _ref1[_j];
      _ref2 = card.data.sources;
      for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
        source = _ref2[_k];
        if (__indexOf.call(this.sources, source) < 0) {
          this.sources.push(source);
        }
      }
    }
    sorted_types = this.types.sort();
    sorted_sources = this.sources.sort();
    this.cards_by_type_name = {};
    for (_l = 0, _len3 = sorted_types.length; _l < _len3; _l++) {
      type = sorted_types[_l];
      this.cards_by_type_name[type] = ((function() {
        var _len4, _m, _ref3, _results;
        _ref3 = this.all_cards;
        _results = [];
        for (_m = 0, _len4 = _ref3.length; _m < _len4; _m++) {
          card = _ref3[_m];
          if (card.type === type) {
            _results.push(card);
          }
        }
        return _results;
      }).call(this)).sort(byName);
    }
    this.cards_by_type_points = {};
    for (_m = 0, _len4 = sorted_types.length; _m < _len4; _m++) {
      type = sorted_types[_m];
      this.cards_by_type_points[type] = ((function() {
        var _len5, _n, _ref3, _results;
        _ref3 = this.all_cards;
        _results = [];
        for (_n = 0, _len5 = _ref3.length; _n < _len5; _n++) {
          card = _ref3[_n];
          if (card.type === type) {
            _results.push(card);
          }
        }
        return _results;
      }).call(this)).sort(byPoints);
    }
    this.cards_by_source = {};
    _results = [];
    for (_n = 0, _len5 = sorted_sources.length; _n < _len5; _n++) {
      source = sorted_sources[_n];
      _results.push(this.cards_by_source[source] = ((function() {
        var _len6, _o, _ref3, _results1;
        _ref3 = this.all_cards;
        _results1 = [];
        for (_o = 0, _len6 = _ref3.length; _o < _len6; _o++) {
          card = _ref3[_o];
          if (__indexOf.call(card.data.sources, source) >= 0) {
            _results1.push(card);
          }
        }
        return _results1;
      }).call(this)).sort(byName));
    }
    return _results;
  };

  CardBrowser.prototype.renderList = function(sort_by) {
    var card, optgroup, source, type, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _len5, _len6, _m, _n, _o, _ref, _ref1, _ref2, _ref3, _ref4, _ref5, _ref6;
    if (sort_by == null) {
      sort_by = 'name';
    }
    if (this.card_selector != null) {
      this.card_selector.remove();
    }
    this.card_selector = $(document.createElement('SELECT'));
    this.card_selector.addClass('card-selector');
    this.card_selector.attr('size', 25);
    this.card_selector_container.append(this.card_selector);
    switch (sort_by) {
      case 'type-by-name':
        _ref = this.types;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          type = _ref[_i];
          optgroup = $(document.createElement('OPTGROUP'));
          optgroup.attr('label', type);
          this.card_selector.append(optgroup);
          _ref1 = this.cards_by_type_name[type];
          for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
            card = _ref1[_j];
            this.addCardTo(optgroup, card);
          }
        }
        break;
      case 'type-by-points':
        _ref2 = this.types;
        for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
          type = _ref2[_k];
          optgroup = $(document.createElement('OPTGROUP'));
          optgroup.attr('label', type);
          this.card_selector.append(optgroup);
          _ref3 = this.cards_by_type_points[type];
          for (_l = 0, _len3 = _ref3.length; _l < _len3; _l++) {
            card = _ref3[_l];
            this.addCardTo(optgroup, card);
          }
        }
        break;
      case 'source':
        _ref4 = this.sources;
        for (_m = 0, _len4 = _ref4.length; _m < _len4; _m++) {
          source = _ref4[_m];
          optgroup = $(document.createElement('OPTGROUP'));
          optgroup.attr('label', source);
          this.card_selector.append(optgroup);
          _ref5 = this.cards_by_source[source];
          for (_n = 0, _len5 = _ref5.length; _n < _len5; _n++) {
            card = _ref5[_n];
            this.addCardTo(optgroup, card);
          }
        }
        break;
      default:
        _ref6 = this.all_cards;
        for (_o = 0, _len6 = _ref6.length; _o < _len6; _o++) {
          card = _ref6[_o];
          this.addCardTo(this.card_selector, card);
        }
    }
    return this.card_selector.change((function(_this) {
      return function(e) {
        return _this.renderCard($(_this.card_selector.find(':selected')));
      };
    })(this));
  };

  CardBrowser.prototype.renderCard = function(card) {
    var action, data, name, orig_type, ship, slot, source, type, _ref, _ref1, _ref10, _ref11, _ref12, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8, _ref9;
    name = card.data('name');
    type = card.data('type');
    data = card.data('card');
    orig_type = card.data('orig_type');
    this.card_viewer_container.find('.info-name').html("" + (data.unique ? "&middot;&nbsp;" : "") + name + " (" + data.points + ")" + (data.limited != null ? " (" + (exportObj.translate(this.language, 'ui', 'limited')) + ")" : "") + (data.epic != null ? " (" + (exportObj.translate(this.language, 'ui', 'epic')) + ")" : "") + (exportObj.isReleased(data) ? "" : " (" + (exportObj.translate(this.language, 'ui', 'unreleased')) + ")"));
    this.card_viewer_container.find('p.info-text').html((_ref = data.text) != null ? _ref : '');
    this.card_viewer_container.find('.info-sources').text(((function() {
      var _i, _len, _ref1, _results;
      _ref1 = data.sources;
      _results = [];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        source = _ref1[_i];
        _results.push(exportObj.translate(this.language, 'sources', source));
      }
      return _results;
    }).call(this)).sort().join(', '));
    switch (orig_type) {
      case 'Pilot':
        ship = exportObj.ships[data.ship];
        this.card_viewer_container.find('.info-type').text("" + data.ship + " Pilot (" + data.faction + ")");
        this.card_viewer_container.find('tr.info-skill td.info-data').text(data.skill);
        this.card_viewer_container.find('tr.info-skill').show();
        this.card_viewer_container.find('tr.info-attack td.info-data').text((_ref1 = (_ref2 = data.ship_override) != null ? _ref2.attack : void 0) != null ? _ref1 : ship.attack);
        this.card_viewer_container.find('tr.info-attack').toggle((((_ref3 = data.ship_override) != null ? _ref3.attack : void 0) != null) || (ship.attack != null));
        this.card_viewer_container.find('tr.info-energy td.info-data').text((_ref4 = (_ref5 = data.ship_override) != null ? _ref5.energy : void 0) != null ? _ref4 : ship.energy);
        this.card_viewer_container.find('tr.info-energy').toggle((((_ref6 = data.ship_override) != null ? _ref6.energy : void 0) != null) || (ship.energy != null));
        this.card_viewer_container.find('tr.info-range').hide();
        this.card_viewer_container.find('tr.info-agility td.info-data').text((_ref7 = (_ref8 = data.ship_override) != null ? _ref8.agility : void 0) != null ? _ref7 : ship.agility);
        this.card_viewer_container.find('tr.info-agility').show();
        this.card_viewer_container.find('tr.info-hull td.info-data').text((_ref9 = (_ref10 = data.ship_override) != null ? _ref10.hull : void 0) != null ? _ref9 : ship.hull);
        this.card_viewer_container.find('tr.info-hull').show();
        this.card_viewer_container.find('tr.info-shields td.info-data').text((_ref11 = (_ref12 = data.ship_override) != null ? _ref12.shields : void 0) != null ? _ref11 : ship.shields);
        this.card_viewer_container.find('tr.info-shields').show();
        this.card_viewer_container.find('tr.info-actions td.info-data').text(((function() {
          var _i, _len, _ref13, _results;
          _ref13 = exportObj.ships[data.ship].actions;
          _results = [];
          for (_i = 0, _len = _ref13.length; _i < _len; _i++) {
            action = _ref13[_i];
            _results.push(exportObj.translate(this.language, 'action', action));
          }
          return _results;
        }).call(this)).join(', '));
        this.card_viewer_container.find('tr.info-actions').show();
        this.card_viewer_container.find('tr.info-upgrades').show();
        this.card_viewer_container.find('tr.info-upgrades td.info-data').text(((function() {
          var _i, _len, _ref13, _results;
          _ref13 = data.slots;
          _results = [];
          for (_i = 0, _len = _ref13.length; _i < _len; _i++) {
            slot = _ref13[_i];
            _results.push(exportObj.translate(this.language, 'slot', slot));
          }
          return _results;
        }).call(this)).join(', ') || 'None');
        break;
      default:
        this.card_viewer_container.find('.info-type').text(type);
        if (data.faction != null) {
          this.card_viewer_container.find('.info-type').append(" &ndash; " + data.faction + " only");
        }
        this.card_viewer_container.find('tr.info-ship').hide();
        this.card_viewer_container.find('tr.info-skill').hide();
        if (data.energy != null) {
          this.card_viewer_container.find('tr.info-energy td.info-data').text(data.energy);
          this.card_viewer_container.find('tr.info-energy').show();
        } else {
          this.card_viewer_container.find('tr.info-energy').hide();
        }
        if (data.attack != null) {
          this.card_viewer_container.find('tr.info-attack td.info-data').text(data.attack);
          this.card_viewer_container.find('tr.info-attack').show();
        } else {
          this.card_viewer_container.find('tr.info-attack').hide();
        }
        if (data.range != null) {
          this.card_viewer_container.find('tr.info-range td.info-data').text(data.range);
          this.card_viewer_container.find('tr.info-range').show();
        } else {
          this.card_viewer_container.find('tr.info-range').hide();
        }
        this.card_viewer_container.find('tr.info-agility').hide();
        this.card_viewer_container.find('tr.info-hull').hide();
        this.card_viewer_container.find('tr.info-shields').hide();
        this.card_viewer_container.find('tr.info-actions').hide();
        this.card_viewer_container.find('tr.info-upgrades').hide();
    }
    this.card_viewer_container.show();
    return this.card_viewer_placeholder.hide();
  };

  CardBrowser.prototype.addCardTo = function(container, card) {
    var option;
    option = $(document.createElement('OPTION'));
    option.text("" + card.name + " (" + card.data.points + ")");
    option.data('name', card.name);
    option.data('type', card.type);
    option.data('card', card.data);
    option.data('orig_type', card.orig_type);
    return $(container).append(option);
  };

  return CardBrowser;

})();

exportObj = typeof exports !== "undefined" && exports !== null ? exports : this;

exportObj.unreleasedExpansions = ["Ghost Expansion Pack", "Inquisitor's TIE Expansion Pack", "Mist Hunter Expansion Pack", "Punishing One Expansion Pack"];

exportObj.isReleased = function(data) {
  var source, _i, _len, _ref;
  _ref = data.sources;
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    source = _ref[_i];
    if (__indexOf.call(exportObj.unreleasedExpansions, source) < 0) {
      return true;
    }
  }
  return false;
};

String.prototype.canonicalize = function() {
  return this.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/\s+/g, '-');
};

exportObj.hugeOnly = function(ship) {
  var _ref;
  return (_ref = ship.data.huge) != null ? _ref : false;
};

exportObj.basicCardData = function() {
  return {
    ships: {
      "X-Wing": {
        name: "X-Wing",
        factions: ["Rebel Alliance"],
        attack: 3,
        agility: 2,
        hull: 3,
        shields: 2,
        actions: ["Focus", "Target Lock"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 2, 2, 2, 0, 0], [1, 1, 2, 1, 1, 0], [1, 1, 1, 1, 1, 0], [0, 0, 1, 0, 0, 3]]
      },
      "Y-Wing": {
        name: "Y-Wing",
        factions: ["Rebel Alliance", "Scum and Villainy"],
        attack: 2,
        agility: 1,
        hull: 5,
        shields: 3,
        actions: ["Focus", "Target Lock"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 1, 2, 1, 0, 0], [1, 1, 2, 1, 1, 0], [3, 1, 1, 1, 3, 0], [0, 0, 3, 0, 0, 3]]
      },
      "A-Wing": {
        name: "A-Wing",
        factions: ["Rebel Alliance"],
        attack: 2,
        agility: 3,
        hull: 2,
        shields: 2,
        actions: ["Focus", "Target Lock", "Boost", "Evade"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 1, 0], [2, 2, 2, 2, 2, 0], [1, 1, 2, 1, 1, 3], [0, 0, 2, 0, 0, 0], [0, 0, 2, 0, 0, 3]]
      },
      "YT-1300": {
        name: "YT-1300",
        factions: ["Rebel Alliance"],
        attack: 2,
        agility: 1,
        hull: 6,
        shields: 4,
        actions: ["Focus", "Target Lock"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [1, 2, 2, 2, 1, 0], [1, 1, 2, 1, 1, 0], [0, 1, 1, 1, 0, 3], [0, 0, 1, 0, 0, 3]],
        large: true
      },
      "TIE Fighter": {
        name: "TIE Fighter",
        factions: ["Galactic Empire"],
        attack: 2,
        agility: 3,
        hull: 3,
        shields: 0,
        actions: ["Focus", "Barrel Roll", "Evade"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 1, 0], [1, 2, 2, 2, 1, 0], [1, 1, 2, 1, 1, 3], [0, 0, 1, 0, 0, 3], [0, 0, 1, 0, 0, 0]]
      },
      "TIE Advanced": {
        name: "TIE Advanced",
        factions: ["Galactic Empire"],
        attack: 2,
        agility: 3,
        hull: 3,
        shields: 2,
        actions: ["Focus", "Target Lock", "Barrel Roll", "Evade"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 2, 0, 2, 0, 0], [1, 1, 2, 1, 1, 0], [1, 1, 2, 1, 1, 0], [0, 0, 1, 0, 0, 3], [0, 0, 1, 0, 0, 0]]
      },
      "TIE Interceptor": {
        name: "TIE Interceptor",
        factions: ["Galactic Empire"],
        attack: 3,
        agility: 3,
        hull: 3,
        shields: 0,
        actions: ["Focus", "Barrel Roll", "Boost", "Evade"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 1, 0], [2, 2, 2, 2, 2, 0], [1, 1, 2, 1, 1, 3], [0, 0, 2, 0, 0, 0], [0, 0, 1, 0, 0, 3]]
      },
      "Firespray-31": {
        name: "Firespray-31",
        factions: ["Galactic Empire", "Scum and Villainy"],
        attack: 3,
        agility: 2,
        hull: 6,
        shields: 4,
        actions: ["Focus", "Target Lock", "Evade"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 2, 2, 2, 0, 0], [1, 1, 2, 1, 1, 0], [1, 1, 1, 1, 1, 3], [0, 0, 1, 0, 0, 3]],
        large: true
      },
      "HWK-290": {
        name: "HWK-290",
        factions: ["Rebel Alliance", "Scum and Villainy"],
        attack: 1,
        agility: 2,
        hull: 4,
        shields: 1,
        actions: ["Focus", "Target Lock"],
        maneuvers: [[0, 0, 0, 0, 0], [0, 2, 2, 2, 0], [1, 1, 2, 1, 1], [0, 3, 1, 3, 0], [0, 0, 3, 0, 0]]
      },
      "Lambda-Class Shuttle": {
        name: "Lambda-Class Shuttle",
        factions: ["Galactic Empire"],
        attack: 3,
        agility: 1,
        hull: 5,
        shields: 5,
        actions: ["Focus", "Target Lock"],
        maneuvers: [[0, 0, 3, 0, 0], [0, 2, 2, 2, 0], [3, 1, 2, 1, 3], [0, 3, 1, 3, 0]],
        large: true
      },
      "B-Wing": {
        name: "B-Wing",
        factions: ["Rebel Alliance"],
        attack: 3,
        agility: 1,
        hull: 3,
        shields: 5,
        actions: ["Focus", "Target Lock", "Barrel Roll"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [3, 2, 2, 2, 3, 0], [1, 1, 2, 1, 1, 3], [0, 3, 1, 3, 0, 0], [0, 0, 3, 0, 0, 0]]
      },
      "TIE Bomber": {
        name: "TIE Bomber",
        factions: ["Galactic Empire"],
        attack: 2,
        agility: 2,
        hull: 6,
        shields: 0,
        actions: ["Focus", "Target Lock", "Barrel Roll"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 1, 2, 1, 0, 0], [3, 2, 2, 2, 3, 0], [1, 1, 2, 1, 1, 0], [0, 0, 1, 0, 0, 0], [0, 0, 0, 0, 0, 3]]
      },
      "GR-75 Medium Transport": {
        name: "GR-75 Medium Transport",
        factions: ["Rebel Alliance"],
        energy: 4,
        agility: 0,
        hull: 8,
        shields: 4,
        actions: ["Recover", "Reinforce", "Coordinate", "Jam"],
        huge: true,
        epic_points: 2,
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 1, 1, 1, 0, 0], [0, 1, 1, 1, 0, 0], [0, 0, 1, 0, 0, 0], [0, 0, 1, 0, 0, 0]]
      },
      "Z-95 Headhunter": {
        name: "Z-95 Headhunter",
        factions: ["Rebel Alliance", "Scum and Villainy"],
        attack: 2,
        agility: 2,
        hull: 2,
        shields: 2,
        actions: ["Focus", "Target Lock"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 1, 2, 1, 0, 0], [1, 2, 2, 2, 1, 0], [1, 1, 1, 1, 1, 3], [0, 0, 1, 0, 0, 0]]
      },
      "TIE Defender": {
        name: "TIE Defender",
        factions: ["Galactic Empire"],
        attack: 3,
        agility: 3,
        hull: 3,
        shields: 3,
        actions: ["Focus", "Target Lock", "Barrel Roll"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [3, 1, 0, 1, 3, 0], [3, 1, 2, 1, 3, 0], [1, 1, 2, 1, 1, 0], [0, 0, 2, 0, 0, 1], [0, 0, 2, 0, 0, 0]]
      },
      "E-Wing": {
        name: "E-Wing",
        factions: ["Rebel Alliance"],
        attack: 3,
        agility: 3,
        hull: 2,
        shields: 3,
        actions: ["Focus", "Target Lock", "Barrel Roll", "Evade"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 1, 2, 1, 0, 0], [1, 2, 2, 2, 1, 0], [1, 1, 2, 1, 1, 3], [0, 0, 1, 0, 0, 3], [0, 0, 1, 0, 0, 0]]
      },
      "TIE Phantom": {
        name: "TIE Phantom",
        factions: ["Galactic Empire"],
        attack: 4,
        agility: 2,
        hull: 2,
        shields: 2,
        actions: ["Focus", "Barrel Roll", "Evade", "Cloak"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 1, 0], [1, 2, 2, 2, 1, 0], [1, 1, 2, 1, 1, 3], [0, 0, 1, 0, 0, 3]]
      },
      "CR90 Corvette (Fore)": {
        name: "CR90 Corvette (Fore)",
        factions: ["Rebel Alliance"],
        attack: 4,
        agility: 0,
        hull: 8,
        shields: 5,
        actions: ["Coordinate", "Target Lock"],
        huge: true,
        epic_points: 1.5,
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 1, 0, 1, 0, 0], [0, 1, 1, 1, 0, 0], [0, 0, 1, 0, 0, 0], [0, 0, 1, 0, 0, 0]],
        multisection: ["CR90 Corvette (Aft)".canonicalize()],
        canonical_name: "CR90 Corvette".canonicalize()
      },
      "CR90 Corvette (Aft)": {
        name: "CR90 Corvette (Aft)",
        factions: ["Rebel Alliance"],
        energy: 5,
        agility: 0,
        hull: 8,
        shields: 3,
        actions: ["Reinforce", "Recover"],
        huge: true,
        epic_points: 1.5,
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 1, 0, 1, 0, 0], [0, 1, 1, 1, 0, 0], [0, 0, 1, 0, 0, 0], [0, 0, 1, 0, 0, 0]],
        multisection: ["CR90 Corvette (Fore)".canonicalize()],
        canonical_name: "CR90 Corvette".canonicalize()
      },
      "YT-2400": {
        name: "YT-2400",
        canonical_name: "YT-2400 Freighter".canonicalize(),
        factions: ["Rebel Alliance"],
        attack: 2,
        agility: 2,
        hull: 5,
        shields: 5,
        actions: ["Focus", "Target Lock", "Barrel Roll"],
        large: true,
        maneuvers: [[0, 0, 0, 0, 0, 0], [1, 2, 2, 2, 1, 0], [1, 1, 2, 1, 1, 0], [1, 1, 1, 1, 1, 0], [0, 0, 1, 0, 0, 3]]
      },
      "VT-49 Decimator": {
        name: "VT-49 Decimator",
        factions: ["Galactic Empire"],
        attack: 3,
        agility: 0,
        hull: 12,
        shields: 4,
        actions: ["Focus", "Target Lock"],
        large: true,
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 1, 1, 1, 0, 0], [1, 2, 2, 2, 1, 0], [1, 1, 2, 1, 1, 0], [0, 0, 1, 0, 0, 0]]
      },
      "StarViper": {
        name: "StarViper",
        factions: ["Scum and Villainy"],
        attack: 3,
        agility: 3,
        hull: 4,
        shields: 1,
        actions: ["Focus", "Target Lock", "Barrel Roll", "Boost"],
        maneuvers: [[0, 0, 0, 0, 0, 0, 0, 0], [1, 2, 2, 2, 1, 0, 0, 0], [1, 1, 2, 1, 1, 0, 0, 0], [0, 1, 2, 1, 0, 0, 3, 3], [0, 0, 1, 0, 0, 0, 0, 0]]
      },
      "M3-A Interceptor": {
        name: "M3-A Interceptor",
        factions: ["Scum and Villainy"],
        attack: 2,
        agility: 3,
        hull: 2,
        shields: 1,
        actions: ["Focus", "Target Lock", "Barrel Roll", "Evade"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [1, 2, 0, 2, 1, 0], [1, 2, 2, 2, 1, 0], [0, 1, 2, 1, 0, 3], [0, 0, 1, 0, 0, 0], [0, 0, 0, 0, 0, 3]]
      },
      "Aggressor": {
        name: "Aggressor",
        factions: ["Scum and Villainy"],
        attack: 3,
        agility: 3,
        hull: 4,
        shields: 4,
        actions: ["Focus", "Target Lock", "Boost", "Evade"],
        large: true,
        maneuvers: [[0, 0, 0, 0, 0, 0, 0, 0], [1, 2, 2, 2, 1, 0, 0, 0], [1, 2, 2, 2, 1, 0, 0, 0], [0, 2, 2, 2, 0, 0, 3, 3], [0, 0, 0, 0, 0, 3, 0, 0]]
      },
      "Raider-class Corvette (Fore)": {
        name: "Raider-class Corvette (Fore)",
        factions: ["Galactic Empire"],
        attack: 4,
        agility: 0,
        hull: 8,
        shields: 6,
        actions: ["Recover", "Reinforce"],
        huge: true,
        epic_points: 1.5,
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 1, 1, 1, 0, 0], [0, 1, 1, 1, 0, 0], [0, 0, 1, 0, 0, 0], [0, 0, 1, 0, 0, 0]]
      },
      "Raider-class Corvette (Aft)": {
        name: "Raider-class Corvette (Aft)",
        factions: ["Galactic Empire"],
        energy: 6,
        agility: 0,
        hull: 8,
        shields: 4,
        actions: ["Coordinate", "Target Lock"],
        huge: true,
        epic_points: 1.5,
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 1, 1, 1, 0, 0], [0, 1, 1, 1, 0, 0], [0, 0, 1, 0, 0, 0], [0, 0, 1, 0, 0, 0]]
      },
      "YV-666": {
        name: "YV-666",
        factions: ["Scum and Villainy"],
        attack: 3,
        agility: 1,
        hull: 6,
        shields: 6,
        large: true,
        actions: ["Focus", "Target Lock"],
        maneuvers: [[0, 0, 3, 0, 0, 0], [0, 2, 2, 2, 0, 0], [3, 1, 2, 1, 3, 0], [1, 1, 2, 1, 1, 0], [0, 0, 1, 0, 0, 0]]
      },
      "Kihraxz Fighter": {
        name: "Kihraxz Fighter",
        factions: ["Scum and Villainy"],
        attack: 3,
        agility: 2,
        hull: 4,
        shields: 1,
        actions: ["Focus", "Target Lock"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [1, 2, 0, 2, 1, 0], [1, 2, 2, 2, 1, 0], [0, 1, 1, 1, 0, 0], [0, 0, 1, 0, 0, 3], [0, 0, 0, 0, 0, 3]]
      },
      "K-Wing": {
        name: "K-Wing",
        factions: ["Rebel Alliance"],
        attack: 2,
        agility: 1,
        hull: 5,
        shields: 4,
        actions: ["Focus", "Target Lock", "SLAM"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 2, 2, 2, 0, 0], [1, 1, 2, 1, 1, 0], [0, 1, 1, 1, 0, 0]]
      },
      "TIE Punisher": {
        name: "TIE Punisher",
        factions: ["Galactic Empire"],
        attack: 2,
        agility: 1,
        hull: 6,
        shields: 3,
        actions: ["Focus", "Target Lock", "Boost"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 2, 2, 2, 0, 0], [3, 1, 2, 1, 3, 0], [1, 1, 1, 1, 1, 0], [0, 0, 0, 0, 0, 3]]
      },
      "Gozanti-class Cruiser": {
        name: "Gozanti-class Cruiser",
        factions: ["Galactic Empire"],
        energy: 4,
        agility: 0,
        hull: 9,
        shields: 5,
        huge: true,
        epic_points: 2,
        actions: ["Recover", "Reinforce", "Coordinate", "Target Lock"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 1, 1, 1, 0, 0], [0, 1, 1, 1, 0, 0], [0, 0, 1, 0, 0, 0], [0, 0, 1, 0, 0, 0]]
      },
      "VCX-100": {
        name: "VCX-100",
        factions: ["Rebel Alliance"],
        attack: 4,
        agility: 0,
        hull: 10,
        shields: 6,
        large: true,
        actions: ["Focus", "Target Lock", "Evade"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [3, 1, 2, 1, 3, 0], [1, 2, 2, 2, 1, 0], [3, 1, 1, 1, 3, 0], [0, 0, 1, 0, 0, 0], [0, 0, 0, 0, 0, 3]]
      },
      "Attack Shuttle": {
        name: "Attack Shuttle",
        factions: ["Rebel Alliance"],
        attack: 3,
        agility: 2,
        hull: 2,
        shields: 2,
        actions: ["Focus", "Barrel Roll", "Evade"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [3, 2, 2, 2, 3, 0], [1, 1, 2, 1, 1, 0], [3, 1, 1, 1, 3, 0], [0, 0, 1, 0, 0, 3]]
      },
      "TIE Advanced Prototype": {
        name: "TIE Advanced Prototype",
        canonical_name: 'TIE Adv. Prototype'.canonicalize(),
        factions: ["Galactic Empire"],
        attack: 2,
        agility: 3,
        hull: 2,
        shields: 2,
        actions: ["Focus", "Target Lock", "Barrel Roll", "Boost"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [2, 2, 0, 2, 2, 0], [1, 1, 2, 1, 1, 0], [1, 1, 2, 1, 1, 0], [0, 0, 2, 0, 0, 3], [0, 0, 1, 0, 0, 0]]
      },
      "G-1A Starfighter": {
        name: "G-1A Starfighter",
        factions: ["Scum and Villainy"],
        attack: 3,
        agility: 1,
        hull: 4,
        shields: 4,
        actions: ["Focus", "Target Lock", "Evade"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [3, 2, 2, 2, 3, 0], [1, 1, 2, 1, 1, 0], [0, 3, 2, 3, 0, 3], [0, 0, 1, 0, 0, 3]]
      },
      "JumpMaster 5000": {
        name: "JumpMaster 5000",
        factions: ["Scum and Villainy"],
        large: true,
        attack: 2,
        agility: 2,
        hull: 5,
        shields: 4,
        actions: ["Focus", "Target Lock", "Barrel Roll"],
        maneuvers: [[0, 0, 0, 0, 0, 0, 0, 0], [2, 2, 2, 1, 1, 0, 0, 0], [2, 2, 2, 1, 1, 0, 1, 3], [0, 1, 1, 1, 0, 0, 0, 0], [0, 0, 1, 0, 0, 3, 0, 0]]
      },
      "T-70 X-Wing": {
        name: "T-70 X-Wing",
        factions: ["Resistance"],
        attack: 3,
        agility: 2,
        hull: 3,
        shields: 3,
        actions: ["Focus", "Target Lock", "Boost"],
        maneuvers: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 2, 2, 2, 0, 0, 0, 0, 0, 0], [1, 1, 2, 1, 1, 0, 0, 0, 0, 0], [1, 1, 2, 1, 1, 0, 0, 0, 3, 3], [0, 0, 1, 0, 0, 3, 0, 0, 0, 0]]
      },
      "TIE/fo Fighter": {
        name: "TIE/fo Fighter",
        factions: ["First Order"],
        attack: 2,
        agility: 3,
        hull: 3,
        shields: 1,
        actions: ["Focus", "Target Lock", "Barrel Roll", "Evade"],
        maneuvers: [[0, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 1, 0, 0, 0], [2, 2, 2, 2, 2, 0, 3, 3], [1, 1, 2, 1, 1, 0, 0, 0], [0, 0, 1, 0, 0, 3, 0, 0], [0, 0, 1, 0, 0, 0, 0, 0]]
      }
    },
    pilotsById: [
      {
        name: "Wedge Antilles",
        faction: "Rebel Alliance",
        id: 0,
        unique: true,
        ship: "X-Wing",
        skill: 9,
        points: 29,
        slots: ["Elite", "Torpedo", "Astromech"]
      }, {
        name: "Garven Dreis",
        faction: "Rebel Alliance",
        id: 1,
        unique: true,
        ship: "X-Wing",
        skill: 6,
        points: 26,
        slots: ["Torpedo", "Astromech"]
      }, {
        name: "Red Squadron Pilot",
        faction: "Rebel Alliance",
        id: 2,
        ship: "X-Wing",
        skill: 4,
        points: 23,
        slots: ["Torpedo", "Astromech"]
      }, {
        name: "Rookie Pilot",
        faction: "Rebel Alliance",
        id: 3,
        ship: "X-Wing",
        skill: 2,
        points: 21,
        slots: ["Torpedo", "Astromech"]
      }, {
        name: "Biggs Darklighter",
        faction: "Rebel Alliance",
        id: 4,
        unique: true,
        ship: "X-Wing",
        skill: 5,
        points: 25,
        slots: ["Torpedo", "Astromech"]
      }, {
        name: "Luke Skywalker",
        faction: "Rebel Alliance",
        id: 5,
        unique: true,
        ship: "X-Wing",
        skill: 8,
        points: 28,
        slots: ["Elite", "Torpedo", "Astromech"]
      }, {
        name: "Gray Squadron Pilot",
        faction: "Rebel Alliance",
        id: 6,
        ship: "Y-Wing",
        skill: 4,
        points: 20,
        slots: ["Turret", "Torpedo", "Torpedo", "Astromech"]
      }, {
        name: '"Dutch" Vander',
        faction: "Rebel Alliance",
        id: 7,
        unique: true,
        ship: "Y-Wing",
        skill: 6,
        points: 23,
        slots: ["Turret", "Torpedo", "Torpedo", "Astromech"]
      }, {
        name: "Horton Salm",
        faction: "Rebel Alliance",
        id: 8,
        unique: true,
        ship: "Y-Wing",
        skill: 8,
        points: 25,
        slots: ["Turret", "Torpedo", "Torpedo", "Astromech"]
      }, {
        name: "Gold Squadron Pilot",
        faction: "Rebel Alliance",
        id: 9,
        ship: "Y-Wing",
        skill: 2,
        points: 18,
        slots: ["Turret", "Torpedo", "Torpedo", "Astromech"]
      }, {
        name: "Academy Pilot",
        faction: "Galactic Empire",
        id: 10,
        ship: "TIE Fighter",
        skill: 1,
        points: 12,
        slots: []
      }, {
        name: "Obsidian Squadron Pilot",
        faction: "Galactic Empire",
        id: 11,
        ship: "TIE Fighter",
        skill: 3,
        points: 13,
        slots: []
      }, {
        name: "Black Squadron Pilot",
        faction: "Galactic Empire",
        id: 12,
        ship: "TIE Fighter",
        skill: 4,
        points: 14,
        slots: ["Elite"]
      }, {
        name: '"Winged Gundark"',
        faction: "Galactic Empire",
        id: 13,
        unique: true,
        ship: "TIE Fighter",
        skill: 5,
        points: 15,
        slots: []
      }, {
        name: '"Night Beast"',
        faction: "Galactic Empire",
        id: 14,
        unique: true,
        ship: "TIE Fighter",
        skill: 5,
        points: 15,
        slots: []
      }, {
        name: '"Backstabber"',
        faction: "Galactic Empire",
        id: 15,
        unique: true,
        ship: "TIE Fighter",
        skill: 6,
        points: 16,
        slots: []
      }, {
        name: '"Dark Curse"',
        faction: "Galactic Empire",
        id: 16,
        unique: true,
        ship: "TIE Fighter",
        skill: 6,
        points: 16,
        slots: []
      }, {
        name: '"Mauler Mithel"',
        faction: "Galactic Empire",
        id: 17,
        unique: true,
        ship: "TIE Fighter",
        skill: 7,
        points: 17,
        slots: ["Elite"]
      }, {
        name: '"Howlrunner"',
        faction: "Galactic Empire",
        id: 18,
        unique: true,
        ship: "TIE Fighter",
        skill: 8,
        points: 18,
        slots: ["Elite"]
      }, {
        name: "Maarek Stele",
        faction: "Galactic Empire",
        id: 19,
        unique: true,
        ship: "TIE Advanced",
        skill: 7,
        points: 27,
        slots: ["Elite", "Missile"]
      }, {
        name: "Tempest Squadron Pilot",
        faction: "Galactic Empire",
        id: 20,
        ship: "TIE Advanced",
        skill: 2,
        points: 21,
        slots: ["Missile"]
      }, {
        name: "Storm Squadron Pilot",
        faction: "Galactic Empire",
        id: 21,
        ship: "TIE Advanced",
        skill: 4,
        points: 23,
        slots: ["Missile"]
      }, {
        name: "Darth Vader",
        faction: "Galactic Empire",
        id: 22,
        unique: true,
        ship: "TIE Advanced",
        skill: 9,
        points: 29,
        slots: ["Elite", "Missile"]
      }, {
        name: "Alpha Squadron Pilot",
        faction: "Galactic Empire",
        id: 23,
        ship: "TIE Interceptor",
        skill: 1,
        points: 18,
        slots: []
      }, {
        name: "Avenger Squadron Pilot",
        faction: "Galactic Empire",
        id: 24,
        ship: "TIE Interceptor",
        skill: 3,
        points: 20,
        slots: []
      }, {
        name: "Saber Squadron Pilot",
        faction: "Galactic Empire",
        id: 25,
        ship: "TIE Interceptor",
        skill: 4,
        points: 21,
        slots: ["Elite"]
      }, {
        name: "\"Fel's Wrath\"",
        faction: "Galactic Empire",
        id: 26,
        unique: true,
        ship: "TIE Interceptor",
        skill: 5,
        points: 23,
        slots: []
      }, {
        name: "Turr Phennir",
        faction: "Galactic Empire",
        id: 27,
        unique: true,
        ship: "TIE Interceptor",
        skill: 7,
        points: 25,
        slots: ["Elite"]
      }, {
        name: "Soontir Fel",
        faction: "Galactic Empire",
        id: 28,
        unique: true,
        ship: "TIE Interceptor",
        skill: 9,
        points: 27,
        slots: ["Elite"]
      }, {
        name: "Tycho Celchu",
        faction: "Rebel Alliance",
        id: 29,
        unique: true,
        ship: "A-Wing",
        skill: 8,
        points: 26,
        slots: ["Elite", "Missile"]
      }, {
        name: "Arvel Crynyd",
        faction: "Rebel Alliance",
        id: 30,
        unique: true,
        ship: "A-Wing",
        skill: 6,
        points: 23,
        slots: ["Missile"]
      }, {
        name: "Green Squadron Pilot",
        faction: "Rebel Alliance",
        id: 31,
        ship: "A-Wing",
        skill: 3,
        points: 19,
        slots: ["Elite", "Missile"]
      }, {
        name: "Prototype Pilot",
        faction: "Rebel Alliance",
        id: 32,
        ship: "A-Wing",
        skill: 1,
        points: 17,
        slots: ["Missile"]
      }, {
        name: "Outer Rim Smuggler",
        faction: "Rebel Alliance",
        id: 33,
        ship: "YT-1300",
        skill: 1,
        points: 27,
        slots: ["Crew", "Crew"]
      }, {
        name: "Chewbacca",
        faction: "Rebel Alliance",
        id: 34,
        unique: true,
        ship: "YT-1300",
        skill: 5,
        points: 42,
        slots: ["Elite", "Missile", "Crew", "Crew"],
        ship_override: {
          attack: 3,
          agility: 1,
          hull: 8,
          shields: 5
        }
      }, {
        name: "Lando Calrissian",
        faction: "Rebel Alliance",
        id: 35,
        unique: true,
        ship: "YT-1300",
        skill: 7,
        points: 44,
        slots: ["Elite", "Missile", "Crew", "Crew"],
        ship_override: {
          attack: 3,
          agility: 1,
          hull: 8,
          shields: 5
        }
      }, {
        name: "Han Solo",
        faction: "Rebel Alliance",
        id: 36,
        unique: true,
        ship: "YT-1300",
        skill: 9,
        points: 46,
        slots: ["Elite", "Missile", "Crew", "Crew"],
        ship_override: {
          attack: 3,
          agility: 1,
          hull: 8,
          shields: 5
        }
      }, {
        name: "Kath Scarlet",
        faction: "Galactic Empire",
        id: 37,
        unique: true,
        ship: "Firespray-31",
        skill: 7,
        points: 38,
        slots: ["Elite", "Cannon", "Bomb", "Crew", "Missile"]
      }, {
        name: "Boba Fett",
        faction: "Galactic Empire",
        id: 38,
        unique: true,
        ship: "Firespray-31",
        skill: 8,
        points: 39,
        slots: ["Elite", "Cannon", "Bomb", "Crew", "Missile"]
      }, {
        name: "Krassis Trelix",
        faction: "Galactic Empire",
        id: 39,
        unique: true,
        ship: "Firespray-31",
        skill: 5,
        points: 36,
        slots: ["Cannon", "Bomb", "Crew", "Missile"]
      }, {
        name: "Bounty Hunter",
        faction: "Galactic Empire",
        id: 40,
        ship: "Firespray-31",
        skill: 3,
        points: 33,
        slots: ["Cannon", "Bomb", "Crew", "Missile"]
      }, {
        name: "Ten Numb",
        faction: "Rebel Alliance",
        id: 41,
        unique: true,
        ship: "B-Wing",
        skill: 8,
        points: 31,
        slots: ["Elite", "System", "Cannon", "Torpedo", "Torpedo"]
      }, {
        name: "Ibtisam",
        faction: "Rebel Alliance",
        id: 42,
        unique: true,
        ship: "B-Wing",
        skill: 6,
        points: 28,
        slots: ["Elite", "System", "Cannon", "Torpedo", "Torpedo"]
      }, {
        name: "Dagger Squadron Pilot",
        faction: "Rebel Alliance",
        id: 43,
        ship: "B-Wing",
        skill: 4,
        points: 24,
        slots: ["System", "Cannon", "Torpedo", "Torpedo"]
      }, {
        name: "Blue Squadron Pilot",
        faction: "Rebel Alliance",
        id: 44,
        ship: "B-Wing",
        skill: 2,
        points: 22,
        slots: ["System", "Cannon", "Torpedo", "Torpedo"]
      }, {
        name: "Rebel Operative",
        faction: "Rebel Alliance",
        id: 45,
        ship: "HWK-290",
        skill: 2,
        points: 16,
        slots: ["Turret", "Crew"]
      }, {
        name: "Roark Garnet",
        faction: "Rebel Alliance",
        id: 46,
        unique: true,
        ship: "HWK-290",
        skill: 4,
        points: 19,
        slots: ["Turret", "Crew"]
      }, {
        name: "Kyle Katarn",
        faction: "Rebel Alliance",
        id: 47,
        unique: true,
        ship: "HWK-290",
        skill: 6,
        points: 21,
        slots: ["Elite", "Turret", "Crew"]
      }, {
        name: "Jan Ors",
        faction: "Rebel Alliance",
        id: 48,
        unique: true,
        ship: "HWK-290",
        skill: 8,
        points: 25,
        slots: ["Elite", "Turret", "Crew"]
      }, {
        name: "Scimitar Squadron Pilot",
        faction: "Galactic Empire",
        id: 49,
        ship: "TIE Bomber",
        skill: 2,
        points: 16,
        slots: ["Torpedo", "Torpedo", "Missile", "Missile", "Bomb"]
      }, {
        name: "Gamma Squadron Pilot",
        faction: "Galactic Empire",
        id: 50,
        ship: "TIE Bomber",
        skill: 4,
        points: 18,
        slots: ["Torpedo", "Torpedo", "Missile", "Missile", "Bomb"]
      }, {
        name: "Captain Jonus",
        faction: "Galactic Empire",
        id: 51,
        unique: true,
        ship: "TIE Bomber",
        skill: 6,
        points: 22,
        slots: ["Elite", "Torpedo", "Torpedo", "Missile", "Missile", "Bomb"]
      }, {
        name: "Major Rhymer",
        faction: "Galactic Empire",
        id: 52,
        unique: true,
        ship: "TIE Bomber",
        skill: 7,
        points: 26,
        slots: ["Elite", "Torpedo", "Torpedo", "Missile", "Missile", "Bomb"]
      }, {
        name: "Captain Kagi",
        faction: "Galactic Empire",
        id: 53,
        unique: true,
        ship: "Lambda-Class Shuttle",
        skill: 8,
        points: 27,
        slots: ["System", "Cannon", "Crew", "Crew"]
      }, {
        name: "Colonel Jendon",
        faction: "Galactic Empire",
        id: 54,
        unique: true,
        ship: "Lambda-Class Shuttle",
        skill: 6,
        points: 26,
        slots: ["System", "Cannon", "Crew", "Crew"]
      }, {
        name: "Captain Yorr",
        faction: "Galactic Empire",
        id: 55,
        unique: true,
        ship: "Lambda-Class Shuttle",
        skill: 4,
        points: 24,
        slots: ["System", "Cannon", "Crew", "Crew"]
      }, {
        name: "Omicron Group Pilot",
        faction: "Galactic Empire",
        id: 56,
        ship: "Lambda-Class Shuttle",
        skill: 2,
        points: 21,
        slots: ["System", "Cannon", "Crew", "Crew"]
      }, {
        name: "Lieutenant Lorrir",
        faction: "Galactic Empire",
        id: 57,
        unique: true,
        ship: "TIE Interceptor",
        skill: 5,
        points: 23,
        slots: []
      }, {
        name: "Royal Guard Pilot",
        faction: "Galactic Empire",
        id: 58,
        ship: "TIE Interceptor",
        skill: 6,
        points: 22,
        slots: ["Elite"]
      }, {
        name: "Tetran Cowall",
        faction: "Galactic Empire",
        id: 59,
        unique: true,
        ship: "TIE Interceptor",
        skill: 7,
        points: 24,
        slots: ["Elite"],
        modifier_func: function(stats) {
          return stats.maneuvers[1][5] = 3;
        }
      }, {
        name: "I messed up this pilot, sorry",
        id: 60,
        skip: true
      }, {
        name: "Kir Kanos",
        faction: "Galactic Empire",
        id: 61,
        unique: true,
        ship: "TIE Interceptor",
        skill: 6,
        points: 24,
        slots: []
      }, {
        name: "Carnor Jax",
        faction: "Galactic Empire",
        id: 62,
        unique: true,
        ship: "TIE Interceptor",
        skill: 8,
        points: 26,
        slots: ["Elite"]
      }, {
        name: "GR-75 Medium Transport",
        faction: "Rebel Alliance",
        id: 63,
        epic: true,
        ship: "GR-75 Medium Transport",
        skill: 3,
        points: 30,
        slots: ["Crew", "Crew", "Cargo", "Cargo", "Cargo"]
      }, {
        name: "Bandit Squadron Pilot",
        faction: "Rebel Alliance",
        id: 64,
        ship: "Z-95 Headhunter",
        skill: 2,
        points: 12,
        slots: ["Missile"]
      }, {
        name: "Tala Squadron Pilot",
        faction: "Rebel Alliance",
        id: 65,
        ship: "Z-95 Headhunter",
        skill: 4,
        points: 13,
        slots: ["Missile"]
      }, {
        name: "Lieutenant Blount",
        faction: "Rebel Alliance",
        id: 66,
        unique: true,
        ship: "Z-95 Headhunter",
        skill: 6,
        points: 17,
        slots: ["Elite", "Missile"]
      }, {
        name: "Airen Cracken",
        faction: "Rebel Alliance",
        id: 67,
        unique: true,
        ship: "Z-95 Headhunter",
        skill: 8,
        points: 19,
        slots: ["Elite", "Missile"]
      }, {
        name: "Delta Squadron Pilot",
        faction: "Galactic Empire",
        id: 68,
        ship: "TIE Defender",
        skill: 1,
        points: 30,
        slots: ["Cannon", "Missile"]
      }, {
        name: "Onyx Squadron Pilot",
        faction: "Galactic Empire",
        id: 69,
        ship: "TIE Defender",
        skill: 3,
        points: 32,
        slots: ["Cannon", "Missile"]
      }, {
        name: "Colonel Vessery",
        faction: "Galactic Empire",
        id: 70,
        unique: true,
        ship: "TIE Defender",
        skill: 6,
        points: 35,
        slots: ["Elite", "Cannon", "Missile"]
      }, {
        name: "Rexler Brath",
        faction: "Galactic Empire",
        id: 71,
        unique: true,
        ship: "TIE Defender",
        skill: 8,
        points: 37,
        slots: ["Elite", "Cannon", "Missile"]
      }, {
        name: "Knave Squadron Pilot",
        faction: "Rebel Alliance",
        id: 72,
        ship: "E-Wing",
        skill: 1,
        points: 27,
        slots: ["System", "Torpedo", "Astromech"]
      }, {
        name: "Blackmoon Squadron Pilot",
        faction: "Rebel Alliance",
        id: 73,
        ship: "E-Wing",
        skill: 3,
        points: 29,
        slots: ["System", "Torpedo", "Astromech"]
      }, {
        name: "Etahn A'baht",
        faction: "Rebel Alliance",
        id: 74,
        unique: true,
        ship: "E-Wing",
        skill: 5,
        points: 32,
        slots: ["Elite", "System", "Torpedo", "Astromech"]
      }, {
        name: "Corran Horn",
        faction: "Rebel Alliance",
        id: 75,
        unique: true,
        ship: "E-Wing",
        skill: 8,
        points: 35,
        slots: ["Elite", "System", "Torpedo", "Astromech"]
      }, {
        name: "Sigma Squadron Pilot",
        faction: "Galactic Empire",
        id: 76,
        ship: "TIE Phantom",
        skill: 3,
        points: 25,
        slots: ["System", "Crew"]
      }, {
        name: "Shadow Squadron Pilot",
        faction: "Galactic Empire",
        id: 77,
        ship: "TIE Phantom",
        skill: 5,
        points: 27,
        slots: ["System", "Crew"]
      }, {
        name: '"Echo"',
        faction: "Galactic Empire",
        id: 78,
        unique: true,
        ship: "TIE Phantom",
        skill: 6,
        points: 30,
        slots: ["Elite", "System", "Crew"]
      }, {
        name: '"Whisper"',
        faction: "Galactic Empire",
        id: 79,
        unique: true,
        ship: "TIE Phantom",
        skill: 7,
        points: 32,
        slots: ["Elite", "System", "Crew"]
      }, {
        name: "CR90 Corvette (Fore)",
        faction: "Rebel Alliance",
        id: 80,
        epic: true,
        ship: "CR90 Corvette (Fore)",
        skill: 4,
        points: 50,
        slots: ["Crew", "Hardpoint", "Hardpoint", "Team", "Team", "Cargo"]
      }, {
        name: "CR90 Corvette (Aft)",
        faction: "Rebel Alliance",
        id: 81,
        epic: true,
        ship: "CR90 Corvette (Aft)",
        skill: 4,
        points: 40,
        slots: ["Crew", "Hardpoint", "Team", "Cargo"]
      }, {
        name: "Wes Janson",
        faction: "Rebel Alliance",
        id: 82,
        unique: true,
        ship: "X-Wing",
        skill: 8,
        points: 29,
        slots: ["Elite", "Torpedo", "Astromech"]
      }, {
        name: "Jek Porkins",
        faction: "Rebel Alliance",
        id: 83,
        unique: true,
        ship: "X-Wing",
        skill: 7,
        points: 26,
        slots: ["Elite", "Torpedo", "Astromech"]
      }, {
        name: '"Hobbie" Klivian',
        faction: "Rebel Alliance",
        id: 84,
        unique: true,
        ship: "X-Wing",
        skill: 5,
        points: 25,
        slots: ["Torpedo", "Astromech"]
      }, {
        name: "Tarn Mison",
        faction: "Rebel Alliance",
        id: 85,
        unique: true,
        ship: "X-Wing",
        skill: 3,
        points: 23,
        slots: ["Torpedo", "Astromech"]
      }, {
        name: "Jake Farrell",
        faction: "Rebel Alliance",
        id: 86,
        unique: true,
        ship: "A-Wing",
        skill: 7,
        points: 24,
        slots: ["Elite", "Missile"]
      }, {
        name: "Gemmer Sojan",
        faction: "Rebel Alliance",
        id: 87,
        unique: true,
        ship: "A-Wing",
        skill: 5,
        points: 22,
        slots: ["Missile"]
      }, {
        name: "Keyan Farlander",
        faction: "Rebel Alliance",
        id: 88,
        unique: true,
        ship: "B-Wing",
        skill: 7,
        points: 29,
        slots: ["Elite", "System", "Cannon", "Torpedo", "Torpedo"]
      }, {
        name: "Nera Dantels",
        faction: "Rebel Alliance",
        id: 89,
        unique: true,
        ship: "B-Wing",
        skill: 5,
        points: 26,
        slots: ["Elite", "System", "Cannon", "Torpedo", "Torpedo"]
      }, {
        name: "CR90 Corvette (Crippled Fore)",
        skip: true,
        faction: "Rebel Alliance",
        id: 90,
        ship: "CR90 Corvette (Fore)",
        skill: 4,
        points: 0,
        epic: true,
        slots: ["Crew"],
        ship_override: {
          attack: 2,
          agility: 0,
          hull: 0,
          shields: 0,
          actions: []
        }
      }, {
        name: "CR90 Corvette (Crippled Aft)",
        skip: true,
        faction: "Rebel Alliance",
        id: 91,
        ship: "CR90 Corvette (Aft)",
        skill: 4,
        points: 0,
        epic: true,
        slots: ["Cargo"],
        ship_override: {
          energy: 1,
          agility: 0,
          hull: 0,
          shields: 0,
          actions: []
        },
        modifier_func: function(stats) {
          stats.maneuvers[2][1] = 0;
          stats.maneuvers[2][3] = 0;
          return stats.maneuvers[4][2] = 0;
        }
      }, {
        name: "Wild Space Fringer",
        faction: "Rebel Alliance",
        id: 92,
        ship: "YT-2400",
        skill: 2,
        points: 30,
        slots: ["Cannon", "Missile", "Crew"]
      }, {
        name: "Eaden Vrill",
        faction: "Rebel Alliance",
        id: 93,
        ship: "YT-2400",
        unique: true,
        skill: 3,
        points: 32,
        slots: ["Cannon", "Missile", "Crew"]
      }, {
        name: '"Leebo"',
        faction: "Rebel Alliance",
        id: 94,
        ship: "YT-2400",
        unique: true,
        skill: 5,
        points: 34,
        slots: ["Elite", "Cannon", "Missile", "Crew"]
      }, {
        name: "Dash Rendar",
        faction: "Rebel Alliance",
        id: 95,
        ship: "YT-2400",
        unique: true,
        skill: 7,
        points: 36,
        slots: ["Elite", "Cannon", "Missile", "Crew"]
      }, {
        name: "Patrol Leader",
        faction: "Galactic Empire",
        id: 96,
        ship: "VT-49 Decimator",
        skill: 3,
        points: 40,
        slots: ["Torpedo", "Crew", "Crew", "Crew", "Bomb"]
      }, {
        name: "Captain Oicunn",
        faction: "Galactic Empire",
        id: 97,
        ship: "VT-49 Decimator",
        skill: 4,
        points: 42,
        unique: true,
        slots: ["Elite", "Torpedo", "Crew", "Crew", "Crew", "Bomb"]
      }, {
        name: "Commander Kenkirk",
        faction: "Galactic Empire",
        id: 98,
        ship: "VT-49 Decimator",
        skill: 6,
        points: 44,
        unique: true,
        slots: ["Elite", "Torpedo", "Crew", "Crew", "Crew", "Bomb"]
      }, {
        name: "Rear Admiral Chiraneau",
        faction: "Galactic Empire",
        id: 99,
        ship: "VT-49 Decimator",
        skill: 8,
        points: 46,
        unique: true,
        slots: ["Elite", "Torpedo", "Crew", "Crew", "Crew", "Bomb"]
      }, {
        name: "Prince Xizor",
        faction: "Scum and Villainy",
        id: 100,
        unique: true,
        ship: "StarViper",
        skill: 7,
        points: 31,
        slots: ["Elite", "Torpedo"]
      }, {
        name: "Guri",
        faction: "Scum and Villainy",
        id: 101,
        unique: true,
        ship: "StarViper",
        skill: 5,
        points: 30,
        slots: ["Elite", "Torpedo"]
      }, {
        name: "Black Sun Vigo",
        faction: "Scum and Villainy",
        id: 102,
        ship: "StarViper",
        skill: 3,
        points: 27,
        slots: ["Torpedo"]
      }, {
        name: "Black Sun Enforcer",
        faction: "Scum and Villainy",
        id: 103,
        ship: "StarViper",
        skill: 1,
        points: 25,
        slots: ["Torpedo"]
      }, {
        name: "Serissu",
        faction: "Scum and Villainy",
        id: 104,
        ship: "M3-A Interceptor",
        skill: 8,
        points: 20,
        unique: true,
        slots: ["Elite"]
      }, {
        name: "Laetin A'shera",
        faction: "Scum and Villainy",
        id: 105,
        ship: "M3-A Interceptor",
        skill: 6,
        points: 18,
        unique: true,
        slots: []
      }, {
        name: "Tansarii Point Veteran",
        faction: "Scum and Villainy",
        id: 106,
        ship: "M3-A Interceptor",
        skill: 5,
        points: 17,
        slots: ["Elite"]
      }, {
        name: "Cartel Spacer",
        faction: "Scum and Villainy",
        id: 107,
        ship: "M3-A Interceptor",
        skill: 2,
        points: 14,
        slots: []
      }, {
        name: "IG-88A",
        faction: "Scum and Villainy",
        id: 108,
        unique: true,
        ship: "Aggressor",
        skill: 6,
        points: 36,
        slots: ["Elite", "System", "Cannon", "Cannon", "Bomb", "Illicit"]
      }, {
        name: "IG-88B",
        faction: "Scum and Villainy",
        id: 109,
        unique: true,
        ship: "Aggressor",
        skill: 6,
        points: 36,
        slots: ["Elite", "System", "Cannon", "Cannon", "Bomb", "Illicit"]
      }, {
        name: "IG-88C",
        faction: "Scum and Villainy",
        id: 110,
        unique: true,
        ship: "Aggressor",
        skill: 6,
        points: 36,
        slots: ["Elite", "System", "Cannon", "Cannon", "Bomb", "Illicit"]
      }, {
        name: "IG-88D",
        faction: "Scum and Villainy",
        id: 111,
        unique: true,
        ship: "Aggressor",
        skill: 6,
        points: 36,
        slots: ["Elite", "System", "Cannon", "Cannon", "Bomb", "Illicit"]
      }, {
        name: "N'Dru Suhlak",
        unique: true,
        faction: "Scum and Villainy",
        id: 112,
        ship: "Z-95 Headhunter",
        skill: 7,
        points: 17,
        slots: ["Elite", "Missile", "Illicit"]
      }, {
        name: "Kaa'To Leeachos",
        unique: true,
        faction: "Scum and Villainy",
        id: 113,
        ship: "Z-95 Headhunter",
        skill: 5,
        points: 15,
        slots: ["Elite", "Missile", "Illicit"]
      }, {
        name: "Black Sun Soldier",
        faction: "Scum and Villainy",
        id: 114,
        ship: "Z-95 Headhunter",
        skill: 3,
        points: 13,
        slots: ["Missile", "Illicit"]
      }, {
        name: "Binayre Pirate",
        faction: "Scum and Villainy",
        id: 115,
        ship: "Z-95 Headhunter",
        skill: 1,
        points: 12,
        slots: ["Missile", "Illicit"]
      }, {
        name: "Boba Fett (Scum)",
        canonical_name: 'Boba Fett'.canonicalize(),
        faction: "Scum and Villainy",
        id: 116,
        ship: "Firespray-31",
        skill: 8,
        points: 39,
        unique: true,
        slots: ["Elite", "Cannon", "Bomb", "Crew", "Missile", "Illicit"]
      }, {
        name: "Kath Scarlet (Scum)",
        canonical_name: 'Kath Scarlet'.canonicalize(),
        unique: true,
        faction: "Scum and Villainy",
        id: 117,
        ship: "Firespray-31",
        skill: 7,
        points: 38,
        slots: ["Elite", "Cannon", "Bomb", "Crew", "Missile", "Illicit"]
      }, {
        name: "Emon Azzameen",
        unique: true,
        faction: "Scum and Villainy",
        id: 118,
        ship: "Firespray-31",
        skill: 6,
        points: 36,
        slots: ["Cannon", "Bomb", "Crew", "Missile", "Illicit"]
      }, {
        name: "Mandalorian Mercenary",
        faction: "Scum and Villainy",
        id: 119,
        ship: "Firespray-31",
        skill: 5,
        points: 35,
        slots: ["Elite", "Cannon", "Bomb", "Crew", "Missile", "Illicit"]
      }, {
        name: "Kavil",
        unique: true,
        faction: "Scum and Villainy",
        id: 120,
        ship: "Y-Wing",
        skill: 7,
        points: 24,
        slots: ["Elite", "Turret", "Torpedo", "Torpedo", "Salvaged Astromech"]
      }, {
        name: "Drea Renthal",
        unique: true,
        faction: "Scum and Villainy",
        id: 121,
        ship: "Y-Wing",
        skill: 5,
        points: 22,
        slots: ["Turret", "Torpedo", "Torpedo", "Salvaged Astromech"]
      }, {
        name: "Hired Gun",
        faction: "Scum and Villainy",
        id: 122,
        ship: "Y-Wing",
        skill: 4,
        points: 20,
        slots: ["Turret", "Torpedo", "Torpedo", "Salvaged Astromech"]
      }, {
        name: "Syndicate Thug",
        faction: "Scum and Villainy",
        id: 123,
        ship: "Y-Wing",
        skill: 2,
        points: 18,
        slots: ["Turret", "Torpedo", "Torpedo", "Salvaged Astromech"]
      }, {
        name: "Dace Bonearm",
        unique: true,
        faction: "Scum and Villainy",
        id: 124,
        ship: "HWK-290",
        skill: 7,
        points: 23,
        slots: ["Elite", "Turret", "Crew", "Illicit"]
      }, {
        name: "Palob Godalhi",
        unique: true,
        faction: "Scum and Villainy",
        id: 125,
        ship: "HWK-290",
        skill: 5,
        points: 20,
        slots: ["Elite", "Turret", "Crew", "Illicit"]
      }, {
        name: "Torkil Mux",
        unique: true,
        faction: "Scum and Villainy",
        id: 126,
        ship: "HWK-290",
        skill: 3,
        points: 19,
        slots: ["Turret", "Crew", "Illicit"]
      }, {
        name: "Spice Runner",
        faction: "Scum and Villainy",
        id: 127,
        ship: "HWK-290",
        skill: 1,
        points: 16,
        slots: ["Turret", "Crew", "Illicit"]
      }, {
        name: "Commander Alozen",
        faction: "Galactic Empire",
        id: 128,
        ship: "TIE Advanced",
        unique: true,
        skill: 5,
        points: 25,
        slots: ["Elite", "Missile"]
      }, {
        name: "Raider-class Corvette (Fore)",
        faction: "Galactic Empire",
        id: 129,
        ship: "Raider-class Corvette (Fore)",
        skill: 4,
        points: 50,
        epic: true,
        slots: ["Hardpoint", "Team", "Cargo"]
      }, {
        name: "Raider-class Corvette (Aft)",
        faction: "Galactic Empire",
        id: 130,
        ship: "Raider-class Corvette (Aft)",
        skill: 4,
        points: 50,
        epic: true,
        slots: ["Crew", "Crew", "Hardpoint", "Hardpoint", "Team", "Team", "Cargo"]
      }, {
        name: "Bossk",
        faction: "Scum and Villainy",
        id: 131,
        ship: "YV-666",
        unique: true,
        skill: 7,
        points: 35,
        slots: ["Elite", "Cannon", "Missile", "Crew", "Crew", "Crew", "Illicit"]
      }, {
        name: "Moralo Eval",
        faction: "Scum and Villainy",
        id: 132,
        ship: "YV-666",
        unique: true,
        skill: 6,
        points: 34,
        slots: ["Cannon", "Missile", "Crew", "Crew", "Crew", "Illicit"]
      }, {
        name: "Latts Razzi",
        faction: "Scum and Villainy",
        id: 133,
        ship: "YV-666",
        unique: true,
        skill: 5,
        points: 33,
        slots: ["Cannon", "Missile", "Crew", "Crew", "Crew", "Illicit"]
      }, {
        name: "Trandoshan Slaver",
        faction: "Scum and Villainy",
        id: 134,
        ship: "YV-666",
        skill: 2,
        points: 29,
        slots: ["Cannon", "Missile", "Crew", "Crew", "Crew", "Illicit"]
      }, {
        name: "Talonbane Cobra",
        unique: true,
        id: 135,
        faction: "Scum and Villainy",
        ship: "Kihraxz Fighter",
        skill: 9,
        slots: ["Elite", "Missile", "Illicit"],
        points: 28
      }, {
        name: "Graz the Hunter",
        unique: true,
        id: 136,
        faction: "Scum and Villainy",
        ship: "Kihraxz Fighter",
        skill: 6,
        slots: ["Missile", "Illicit"],
        points: 25
      }, {
        name: "Black Sun Ace",
        faction: "Scum and Villainy",
        id: 137,
        ship: "Kihraxz Fighter",
        skill: 5,
        slots: ["Elite", "Missile", "Illicit"],
        points: 23
      }, {
        name: "Cartel Marauder",
        faction: "Scum and Villainy",
        id: 138,
        ship: "Kihraxz Fighter",
        skill: 2,
        slots: ["Missile", "Illicit"],
        points: 20
      }, {
        name: "Miranda Doni",
        unique: true,
        id: 139,
        faction: "Rebel Alliance",
        ship: "K-Wing",
        skill: 8,
        slots: ["Turret", "Torpedo", "Torpedo", "Missile", "Crew", "Bomb", "Bomb"],
        points: 29
      }, {
        name: "Esege Tuketu",
        unique: true,
        id: 140,
        faction: "Rebel Alliance",
        ship: "K-Wing",
        skill: 6,
        slots: ["Turret", "Torpedo", "Torpedo", "Missile", "Crew", "Bomb", "Bomb"],
        points: 28
      }, {
        name: "Guardian Squadron Pilot",
        faction: "Rebel Alliance",
        id: 141,
        ship: "K-Wing",
        skill: 4,
        slots: ["Turret", "Torpedo", "Torpedo", "Missile", "Crew", "Bomb", "Bomb"],
        points: 25
      }, {
        name: "Warden Squadron Pilot",
        faction: "Rebel Alliance",
        id: 142,
        ship: "K-Wing",
        skill: 2,
        slots: ["Turret", "Torpedo", "Torpedo", "Missile", "Crew", "Bomb", "Bomb"],
        points: 23
      }, {
        name: '"Redline"',
        unique: true,
        id: 143,
        faction: "Galactic Empire",
        ship: "TIE Punisher",
        skill: 7,
        slots: ["System", "Torpedo", "Torpedo", "Missile", "Missile", "Bomb", "Bomb"],
        points: 27
      }, {
        name: '"Deathrain"',
        unique: true,
        id: 144,
        faction: "Galactic Empire",
        ship: "TIE Punisher",
        skill: 6,
        slots: ["System", "Torpedo", "Torpedo", "Missile", "Missile", "Bomb", "Bomb"],
        points: 26
      }, {
        name: 'Black Eight Squadron Pilot',
        canonical_name: 'Black Eight Sq. Pilot'.canonicalize(),
        faction: "Galactic Empire",
        id: 145,
        ship: "TIE Punisher",
        skill: 4,
        slots: ["System", "Torpedo", "Torpedo", "Missile", "Missile", "Bomb", "Bomb"],
        points: 23
      }, {
        name: 'Cutlass Squadron Pilot',
        faction: "Galactic Empire",
        id: 146,
        ship: "TIE Punisher",
        skill: 2,
        slots: ["System", "Torpedo", "Torpedo", "Missile", "Missile", "Bomb", "Bomb"],
        points: 21
      }, {
        name: "Juno Eclipse",
        id: 147,
        faction: "Galactic Empire",
        ship: "TIE Advanced",
        unique: true,
        skill: 8,
        points: 28,
        slots: ["Elite", "Missile"]
      }, {
        name: "Zertik Strom",
        id: 148,
        faction: "Galactic Empire",
        ship: "TIE Advanced",
        unique: true,
        skill: 6,
        points: 26,
        slots: ["Elite", "Missile"]
      }, {
        name: "Lieutenant Colzet",
        id: 149,
        faction: "Galactic Empire",
        ship: "TIE Advanced",
        unique: true,
        skill: 3,
        points: 23,
        slots: ["Missile"]
      }, {
        name: "Gozanti-class Cruiser",
        id: 150,
        faction: "Galactic Empire",
        ship: "Gozanti-class Cruiser",
        skill: 2,
        slots: ['Crew', 'Crew', 'Hardpoint', 'Team', 'Cargo', 'Cargo'],
        points: 40
      }, {
        name: '"Scourge"',
        id: 151,
        unique: true,
        faction: "Galactic Empire",
        ship: "TIE Fighter",
        skill: 7,
        slots: ['Elite'],
        points: 17
      }, {
        name: '"Youngster"',
        id: 152,
        unique: true,
        faction: "Galactic Empire",
        ship: "TIE Fighter",
        skill: 6,
        slots: ['Elite'],
        points: 15
      }, {
        name: '"Wampa"',
        id: 153,
        unique: true,
        faction: "Galactic Empire",
        ship: "TIE Fighter",
        skill: 4,
        slots: [],
        points: 14
      }, {
        name: '"Chaser"',
        id: 154,
        unique: true,
        faction: "Galactic Empire",
        ship: "TIE Fighter",
        skill: 3,
        slots: [],
        points: 14
      }, {
        name: "Hera Syndulla",
        id: 155,
        unique: true,
        faction: "Rebel Alliance",
        ship: "VCX-100",
        skill: 7,
        slots: ['System', 'Turret', 'Torpedo', 'Torpedo', 'Crew', 'Crew'],
        points: 40
      }, {
        name: "Kanan Jarrus",
        id: 156,
        unique: true,
        faction: "Rebel Alliance",
        ship: "VCX-100",
        skill: 5,
        slots: ['System', 'Turret', 'Torpedo', 'Torpedo', 'Crew', 'Crew'],
        points: 38
      }, {
        name: '"Chopper"',
        id: 157,
        unique: true,
        faction: "Rebel Alliance",
        ship: "VCX-100",
        skill: 4,
        slots: ['System', 'Turret', 'Torpedo', 'Torpedo', 'Crew', 'Crew'],
        points: 37
      }, {
        name: 'Lothal Rebel',
        id: 158,
        faction: "Rebel Alliance",
        ship: "VCX-100",
        skill: 3,
        slots: ['System', 'Turret', 'Torpedo', 'Torpedo', 'Crew', 'Crew'],
        points: 35
      }, {
        name: 'Hera Syndulla (Attack Shuttle)',
        id: 159,
        canonical_name: 'Hera Syndulla'.canonicalize(),
        unique: true,
        faction: "Rebel Alliance",
        ship: "Attack Shuttle",
        skill: 7,
        slots: ['Elite', 'Turret', 'Crew'],
        points: 22
      }, {
        name: 'Sabine Wren',
        id: 160,
        unique: true,
        faction: "Rebel Alliance",
        ship: "Attack Shuttle",
        skill: 5,
        slots: ['Elite', 'Turret', 'Crew'],
        points: 21
      }, {
        name: 'Ezra Bridger',
        id: 161,
        unique: true,
        faction: "Rebel Alliance",
        ship: "Attack Shuttle",
        skill: 4,
        slots: ['Elite', 'Turret', 'Crew'],
        points: 20
      }, {
        name: '"Zeb" Orrelios',
        id: 162,
        unique: true,
        faction: "Rebel Alliance",
        ship: "Attack Shuttle",
        skill: 3,
        slots: ['Turret', 'Crew'],
        points: 18
      }, {
        name: "The Inquisitor",
        id: 163,
        unique: true,
        faction: "Galactic Empire",
        ship: "TIE Advanced Prototype",
        skill: 8,
        slots: ['Elite', 'Missile'],
        points: 25
      }, {
        name: "Valen Rudor",
        id: 164,
        unique: true,
        faction: "Galactic Empire",
        ship: "TIE Advanced Prototype",
        skill: 6,
        slots: ['Elite', 'Missile'],
        points: 22
      }, {
        name: "Baron of the Empire",
        id: 165,
        faction: "Galactic Empire",
        ship: "TIE Advanced Prototype",
        skill: 4,
        slots: ['Elite', 'Missile'],
        points: 19
      }, {
        name: "Sienar Test Pilot",
        id: 166,
        faction: "Galactic Empire",
        ship: "TIE Advanced Prototype",
        skill: 2,
        slots: ['Missile'],
        points: 16
      }, {
        name: "Zuckuss",
        id: 167,
        unique: true,
        faction: "Scum and Villainy",
        ship: "G-1A Starfighter",
        skill: 7,
        slots: ['Elite', 'Crew', 'System', 'Illicit'],
        points: 28
      }, {
        name: "4-LOM",
        id: 168,
        unique: true,
        faction: "Scum and Villainy",
        ship: "G-1A Starfighter",
        skill: 6,
        slots: ['Elite', 'Crew', 'System', 'Illicit'],
        points: 27
      }, {
        name: "Gand Findsman",
        id: 169,
        faction: "Scum and Villainy",
        ship: "G-1A Starfighter",
        skill: 5,
        slots: ['Elite', 'Crew', 'System', 'Illicit'],
        points: 25
      }, {
        name: "Ruthless Freelancer",
        id: 170,
        faction: "Scum and Villainy",
        ship: "G-1A Starfighter",
        skill: 3,
        slots: ['Crew', 'System', 'Illicit'],
        points: 23
      }, {
        name: "Dengar",
        id: 171,
        unique: true,
        faction: "Scum and Villainy",
        ship: "JumpMaster 5000",
        skill: 9,
        slots: ['Elite', 'Torpedo', 'Torpedo', 'Crew', 'Salvaged Astromech', 'Illicit'],
        points: 33
      }, {
        name: "Tel Trevura",
        id: 172,
        unique: true,
        faction: "Scum and Villainy",
        ship: "JumpMaster 5000",
        skill: 7,
        slots: ['Elite', 'Torpedo', 'Torpedo', 'Crew', 'Salvaged Astromech', 'Illicit'],
        points: 30
      }, {
        name: "Manaroo",
        id: 173,
        unique: true,
        faction: "Scum and Villainy",
        ship: "JumpMaster 5000",
        skill: 4,
        slots: ['Elite', 'Torpedo', 'Torpedo', 'Crew', 'Salvaged Astromech', 'Illicit'],
        points: 27
      }, {
        name: "Contracted Scout",
        id: 174,
        faction: "Scum and Villainy",
        ship: "JumpMaster 5000",
        skill: 3,
        slots: ['Elite', 'Torpedo', 'Torpedo', 'Crew', 'Salvaged Astromech', 'Illicit'],
        points: 25
      }, {
        name: "Poe Dameron",
        id: 175,
        unique: true,
        faction: "Resistance",
        ship: "T-70 X-Wing",
        skill: 8,
        slots: ['Elite', 'Torpedo', 'Astromech', 'Tech'],
        points: 31
      }, {
        name: '"Blue Ace"',
        id: 176,
        unique: true,
        faction: "Resistance",
        ship: "T-70 X-Wing",
        skill: 5,
        slots: ['Torpedo', 'Astromech', 'Tech'],
        points: 27
      }, {
        name: "Red Squadron Veteran",
        id: 177,
        faction: "Resistance",
        ship: "T-70 X-Wing",
        skill: 4,
        slots: ['Elite', 'Torpedo', 'Astromech', 'Tech'],
        points: 26
      }, {
        name: "Blue Squadron Novice",
        id: 178,
        faction: "Resistance",
        ship: "T-70 X-Wing",
        skill: 2,
        slots: ['Torpedo', 'Astromech', 'Tech'],
        points: 24
      }, {
        name: '"Omega Ace"',
        id: 179,
        unique: true,
        faction: "First Order",
        ship: "TIE/fo Fighter",
        skill: 7,
        slots: ['Elite', 'Tech'],
        points: 20
      }, {
        name: '"Epsilon Leader"',
        id: 180,
        unique: true,
        faction: "First Order",
        ship: "TIE/fo Fighter",
        skill: 6,
        slots: ['Tech'],
        points: 19
      }, {
        name: '"Zeta Ace"',
        id: 181,
        unique: true,
        faction: "First Order",
        ship: "TIE/fo Fighter",
        skill: 5,
        slots: ['Elite', 'Tech'],
        points: 18
      }, {
        name: "Omega Squadron Pilot",
        id: 182,
        faction: "First Order",
        ship: "TIE/fo Fighter",
        skill: 4,
        slots: ['Elite', 'Tech'],
        points: 17
      }, {
        name: "Zeta Squadron Pilot",
        id: 183,
        faction: "First Order",
        ship: "TIE/fo Fighter",
        skill: 3,
        slots: ['Tech'],
        points: 16
      }, {
        name: "Epsilon Squadron Pilot",
        id: 184,
        faction: "First Order",
        ship: "TIE/fo Fighter",
        skill: 1,
        slots: ['Tech'],
        points: 15
      }, {
        name: "Ello Asty",
        id: 185,
        unique: true,
        faction: "Resistance",
        ship: "T-70 X-Wing",
        skill: 7,
        slots: ['Elite', 'Torpedo', 'Astromech', 'Tech'],
        points: 30
      }, {
        name: '"Red Ace"',
        id: 186,
        unique: true,
        faction: "Resistance",
        ship: "T-70 X-Wing",
        skill: 6,
        slots: ['Torpedo', 'Astromech', 'Tech'],
        points: 29
      }, {
        name: '"Omega Leader"',
        id: 187,
        unique: true,
        faction: "First Order",
        ship: "TIE/fo Fighter",
        skill: 8,
        slots: ['Elite', 'Tech'],
        points: 21
      }, {
        name: '"Zeta Leader"',
        id: 188,
        unique: true,
        faction: "First Order",
        ship: "TIE/fo Fighter",
        skill: 7,
        slots: ['Elite', 'Tech'],
        points: 20
      }, {
        name: '"Epsilon Ace"',
        id: 189,
        unique: true,
        faction: "First Order",
        ship: "TIE/fo Fighter",
        skill: 4,
        slots: ['Tech'],
        points: 17
      }, {
        name: "Tomax Bren",
        id: 190,
        unique: true,
        faction: "Galactic Empire",
        ship: "TIE Bomber",
        skill: 8,
        slots: ['Elite', 'Torpedo', 'Torpedo', 'Missile', 'Missile', 'Bomb'],
        points: 24
      }, {
        name: "Gamma Squadron Veteran",
        id: 191,
        faction: "Galactic Empire",
        ship: "TIE Bomber",
        skill: 5,
        slots: ['Elite', 'Torpedo', 'Torpedo', 'Missile', 'Missile', 'Bomb'],
        points: 19
      }, {
        name: '"Dea???"',
        id: 192,
        unique: true,
        faction: "Galactic Empire",
        ship: "TIE Bomber",
        skill: 3,
        slots: ['Torpedo', 'Torpedo', 'Missile', 'Missile', 'Bomb'],
        points: 100
      }, {
        name: "Maarek Stele (TIE Defender)",
        canonical_name: 'Maarek Stele'.canonicalize(),
        id: 193,
        unique: true,
        faction: "Galactic Empire",
        ship: "TIE Defender",
        skill: 7,
        slots: ['Cannon', 'Missile'],
        points: 100
      }, {
        name: "Glaive Squa???",
        id: 194,
        faction: "Galactic Empire",
        ship: "TIE Defender",
        skill: 6,
        slots: ['Cannon', 'Missile'],
        points: 100
      }, {
        name: "Count???",
        id: 195,
        unique: true,
        faction: "Galactic Empire",
        ship: "TIE Defender",
        skill: 5,
        slots: ['Cannon', 'Missile'],
        points: 100
      }
    ],
    upgradesById: [
      {
        name: "Ion Cannon Turret",
        id: 0,
        slot: "Turret",
        points: 5,
        attack: 3,
        range: "1-2"
      }, {
        name: "Proton Torpedoes",
        id: 1,
        slot: "Torpedo",
        points: 4,
        attack: 4,
        range: "2-3"
      }, {
        name: "R2 Astromech",
        id: 2,
        slot: "Astromech",
        points: 1,
        modifier_func: function(stats) {
          var turn, _i, _ref, _results;
          if ((stats.maneuvers != null) && stats.maneuvers.length > 0) {
            _results = [];
            for (turn = _i = 0, _ref = stats.maneuvers[1].length; 0 <= _ref ? _i < _ref : _i > _ref; turn = 0 <= _ref ? ++_i : --_i) {
              if (stats.maneuvers[1][turn] > 0) {
                stats.maneuvers[1][turn] = 2;
              }
              if (stats.maneuvers[2][turn] > 0) {
                _results.push(stats.maneuvers[2][turn] = 2);
              } else {
                _results.push(void 0);
              }
            }
            return _results;
          }
        }
      }, {
        name: "R2-D2",
        aka: ["R2-D2 (Crew)"],
        canonical_name: 'r2d2',
        id: 3,
        unique: true,
        slot: "Astromech",
        points: 4
      }, {
        name: "R2-F2",
        id: 4,
        unique: true,
        slot: "Astromech",
        points: 3
      }, {
        name: "R5-D8",
        id: 5,
        unique: true,
        slot: "Astromech",
        points: 3
      }, {
        name: "R5-K6",
        id: 6,
        unique: true,
        slot: "Astromech",
        points: 2
      }, {
        name: "R5 Astromech",
        id: 7,
        slot: "Astromech",
        points: 1
      }, {
        name: "Determination",
        id: 8,
        slot: "Elite",
        points: 1
      }, {
        name: "Swarm Tactics",
        id: 9,
        slot: "Elite",
        points: 2
      }, {
        name: "Squad Leader",
        id: 10,
        unique: true,
        slot: "Elite",
        points: 2
      }, {
        name: "Expert Handling",
        id: 11,
        slot: "Elite",
        points: 2
      }, {
        name: "Marksmanship",
        id: 12,
        slot: "Elite",
        points: 3
      }, {
        name: "Concussion Missiles",
        id: 13,
        slot: "Missile",
        points: 4,
        attack: 4,
        range: "2-3"
      }, {
        name: "Cluster Missiles",
        id: 14,
        slot: "Missile",
        points: 4,
        attack: 3,
        range: "1-2"
      }, {
        name: "Daredevil",
        id: 15,
        slot: "Elite",
        points: 3
      }, {
        name: "Elusiveness",
        id: 16,
        slot: "Elite",
        points: 2
      }, {
        name: "Homing Missiles",
        id: 17,
        slot: "Missile",
        attack: 4,
        range: "2-3",
        points: 5
      }, {
        name: "Push the Limit",
        id: 18,
        slot: "Elite",
        points: 3
      }, {
        name: "Deadeye",
        id: 19,
        slot: "Elite",
        points: 1
      }, {
        name: "Expose",
        id: 20,
        slot: "Elite",
        points: 4
      }, {
        name: "Gunner",
        id: 21,
        slot: "Crew",
        points: 5
      }, {
        name: "Ion Cannon",
        id: 22,
        slot: "Cannon",
        points: 3,
        attack: 3,
        range: "1-3"
      }, {
        name: "Heavy Laser Cannon",
        id: 23,
        slot: "Cannon",
        points: 7,
        attack: 4,
        range: "2-3"
      }, {
        name: "Seismic Charges",
        id: 24,
        slot: "Bomb",
        points: 2
      }, {
        name: "Mercenary Copilot",
        id: 25,
        slot: "Crew",
        points: 2
      }, {
        name: "Assault Missiles",
        id: 26,
        slot: "Missile",
        points: 5,
        attack: 4,
        range: "2-3"
      }, {
        name: "Veteran Instincts",
        id: 27,
        slot: "Elite",
        points: 1,
        modifier_func: function(stats) {
          return stats.skill += 2;
        }
      }, {
        name: "Proximity Mines",
        id: 28,
        slot: "Bomb",
        points: 3
      }, {
        name: "Weapons Engineer",
        id: 29,
        slot: "Crew",
        points: 3
      }, {
        name: "Draw Their Fire",
        id: 30,
        slot: "Elite",
        points: 1
      }, {
        name: "Luke Skywalker",
        id: 31,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Crew",
        points: 7
      }, {
        name: "Nien Nunb",
        id: 32,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Crew",
        points: 1,
        modifier_func: function(stats) {
          var s, _i, _len, _ref, _ref1, _results;
          _ref1 = (_ref = stats.maneuvers) != null ? _ref : [];
          _results = [];
          for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
            s = _ref1[_i];
            if (s[2] > 0) {
              _results.push(s[2] = 2);
            } else {
              _results.push(void 0);
            }
          }
          return _results;
        }
      }, {
        name: "Chewbacca",
        id: 33,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Crew",
        points: 4
      }, {
        name: "Advanced Proton Torpedoes",
        canonical_name: 'Adv. Proton Torpedoes'.canonicalize(),
        id: 34,
        slot: "Torpedo",
        attack: 5,
        range: "1",
        points: 6
      }, {
        name: "Autoblaster",
        id: 35,
        slot: "Cannon",
        attack: 3,
        range: "1",
        points: 5
      }, {
        name: "Fire-Control System",
        id: 36,
        slot: "System",
        points: 2
      }, {
        name: "Blaster Turret",
        id: 37,
        slot: "Turret",
        points: 4,
        attack: 3,
        range: "1-2"
      }, {
        name: "Recon Specialist",
        id: 38,
        slot: "Crew",
        points: 3
      }, {
        name: "Saboteur",
        id: 39,
        slot: "Crew",
        points: 2
      }, {
        name: "Intelligence Agent",
        id: 40,
        slot: "Crew",
        points: 1
      }, {
        name: "Proton Bombs",
        id: 41,
        slot: "Bomb",
        points: 5
      }, {
        name: "Adrenaline Rush",
        id: 42,
        slot: "Elite",
        points: 1
      }, {
        name: "Advanced Sensors",
        id: 43,
        slot: "System",
        points: 3
      }, {
        name: "Sensor Jammer",
        id: 44,
        slot: "System",
        points: 4
      }, {
        name: "Darth Vader",
        id: 45,
        unique: true,
        faction: "Galactic Empire",
        slot: "Crew",
        points: 3
      }, {
        name: "Rebel Captive",
        id: 46,
        unique: true,
        faction: "Galactic Empire",
        slot: "Crew",
        points: 3
      }, {
        name: "Flight Instructor",
        id: 47,
        slot: "Crew",
        points: 4
      }, {
        name: "Navigator",
        id: 48,
        slot: "Crew",
        points: 3,
        epic_restriction_func: function(ship) {
          var _ref;
          return !((_ref = ship.huge) != null ? _ref : false);
        }
      }, {
        name: "Opportunist",
        id: 49,
        slot: "Elite",
        points: 4
      }, {
        name: "Comms Booster",
        id: 50,
        slot: "Cargo",
        points: 4
      }, {
        name: "Slicer Tools",
        id: 51,
        slot: "Cargo",
        points: 7
      }, {
        name: "Shield Projector",
        id: 52,
        slot: "Cargo",
        points: 4
      }, {
        name: "Ion Pulse Missiles",
        id: 53,
        slot: "Missile",
        points: 3,
        attack: 3,
        range: "2-3"
      }, {
        name: "Wingman",
        id: 54,
        slot: "Elite",
        points: 2
      }, {
        name: "Decoy",
        id: 55,
        slot: "Elite",
        points: 2
      }, {
        name: "Outmaneuver",
        id: 56,
        slot: "Elite",
        points: 3
      }, {
        name: "Predator",
        id: 57,
        slot: "Elite",
        points: 3
      }, {
        name: "Flechette Torpedoes",
        id: 58,
        slot: "Torpedo",
        points: 2,
        attack: 3,
        range: "2-3"
      }, {
        name: "R7 Astromech",
        id: 59,
        slot: "Astromech",
        points: 2
      }, {
        name: "R7-T1",
        id: 60,
        unique: true,
        slot: "Astromech",
        points: 3
      }, {
        name: "Tactician",
        id: 61,
        slot: "Crew",
        points: 2,
        limited: true
      }, {
        name: "R2-D2 (Crew)",
        aka: ["R2-D2"],
        canonical_name: 'r2d2',
        id: 62,
        unique: true,
        slot: "Crew",
        points: 4,
        faction: "Rebel Alliance"
      }, {
        name: "C-3PO",
        unique: true,
        id: 63,
        slot: "Crew",
        points: 3,
        faction: "Rebel Alliance"
      }, {
        name: "Single Turbolasers",
        id: 64,
        slot: "Hardpoint",
        points: 8,
        energy: 2,
        attack: 4,
        range: "3-5"
      }, {
        name: "Quad Laser Cannons",
        id: 65,
        slot: "Hardpoint",
        points: 6,
        energy: 2,
        attack: 3,
        range: "1-2"
      }, {
        name: "Tibanna Gas Supplies",
        id: 66,
        slot: "Cargo",
        points: 4,
        limited: true
      }, {
        name: "Ionization Reactor",
        id: 67,
        slot: "Cargo",
        points: 4,
        energy: 5,
        limited: true
      }, {
        name: "Engine Booster",
        id: 68,
        slot: "Cargo",
        points: 3,
        limited: true
      }, {
        name: "R3-A2",
        id: 69,
        unique: true,
        slot: "Astromech",
        points: 2
      }, {
        name: "R2-D6",
        id: 70,
        unique: true,
        slot: "Astromech",
        points: 1,
        restriction_func: function(ship) {
          var conferred_addon, upgrade, _i, _j, _len, _len1, _ref, _ref1, _ref2;
          if (ship.effectiveStats().skill <= 2 || __indexOf.call(ship.pilot.slots, 'Elite') >= 0) {
            return false;
          }
          _ref = ship.upgrades;
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            upgrade = _ref[_i];
            if ((upgrade != null) && ((_ref1 = upgrade.data) != null ? _ref1.name : void 0) !== 'R2-D6') {
              _ref2 = upgrade.conferredAddons;
              for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
                conferred_addon = _ref2[_j];
                if (conferred_addon.slot === 'Elite') {
                  return false;
                }
              }
            }
          }
          return true;
        },
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Elite"
          }
        ]
      }, {
        name: "Enhanced Scopes",
        id: 71,
        slot: "System",
        points: 1
      }, {
        name: "Chardaan Refit",
        id: 72,
        slot: "Missile",
        points: -2,
        ship: "A-Wing"
      }, {
        name: "Proton Rockets",
        id: 73,
        slot: "Missile",
        points: 3,
        attack: 2,
        range: "1"
      }, {
        name: "Kyle Katarn",
        id: 74,
        unique: true,
        slot: "Crew",
        points: 3,
        faction: "Rebel Alliance"
      }, {
        name: "Jan Ors",
        id: 75,
        unique: true,
        slot: "Crew",
        points: 2,
        faction: "Rebel Alliance"
      }, {
        name: "Toryn Farr",
        id: 76,
        unique: true,
        slot: "Crew",
        points: 6,
        faction: "Rebel Alliance",
        restriction_func: exportObj.hugeOnly
      }, {
        name: "R4-D6",
        id: 77,
        unique: true,
        slot: "Astromech",
        points: 1
      }, {
        name: "R5-P9",
        id: 78,
        unique: true,
        slot: "Astromech",
        points: 3
      }, {
        name: "WED-15 Repair Droid",
        id: 79,
        slot: "Crew",
        points: 2,
        restriction_func: exportObj.hugeOnly
      }, {
        name: "Carlist Rieekan",
        id: 80,
        unique: true,
        slot: "Crew",
        points: 3,
        faction: "Rebel Alliance",
        restriction_func: exportObj.hugeOnly
      }, {
        name: "Jan Dodonna",
        id: 81,
        unique: true,
        slot: "Crew",
        points: 6,
        faction: "Rebel Alliance",
        restriction_func: exportObj.hugeOnly
      }, {
        name: "Expanded Cargo Hold",
        id: 82,
        slot: "Cargo",
        points: 1,
        ship: "GR-75 Medium Transport"
      }, {
        name: "Backup Shield Generator",
        id: 83,
        slot: "Cargo",
        limited: true,
        points: 3
      }, {
        name: "EM Emitter",
        id: 84,
        slot: "Cargo",
        limited: true,
        points: 3
      }, {
        name: "Frequency Jammer",
        id: 85,
        slot: "Cargo",
        limited: true,
        points: 4
      }, {
        name: "Han Solo",
        id: 86,
        slot: "Crew",
        unique: true,
        faction: "Rebel Alliance",
        points: 2
      }, {
        name: "Leia Organa",
        id: 87,
        slot: "Crew",
        unique: true,
        faction: "Rebel Alliance",
        points: 4
      }, {
        name: "Targeting Coordinator",
        id: 88,
        slot: "Crew",
        limited: true,
        points: 4
      }, {
        name: "Raymus Antilles",
        id: 89,
        slot: "Crew",
        unique: true,
        faction: "Rebel Alliance",
        points: 6,
        restriction_func: exportObj.hugeOnly
      }, {
        name: "Gunnery Team",
        id: 90,
        slot: "Team",
        limited: true,
        points: 4
      }, {
        name: "Sensor Team",
        id: 91,
        slot: "Team",
        points: 4
      }, {
        name: "Engineering Team",
        id: 92,
        slot: "Team",
        limited: true,
        points: 4
      }, {
        name: "Lando Calrissian",
        id: 93,
        slot: "Crew",
        unique: true,
        faction: "Rebel Alliance",
        points: 3
      }, {
        name: "Mara Jade",
        id: 94,
        slot: "Crew",
        unique: true,
        faction: "Galactic Empire",
        points: 3
      }, {
        name: "Fleet Officer",
        id: 95,
        slot: "Crew",
        faction: "Galactic Empire",
        points: 3
      }, {
        name: "Stay On Target",
        id: 96,
        slot: "Elite",
        points: 2
      }, {
        name: "Dash Rendar",
        id: 97,
        unique: true,
        slot: "Crew",
        points: 2,
        faction: "Rebel Alliance"
      }, {
        name: "Lone Wolf",
        id: 98,
        unique: true,
        slot: "Elite",
        points: 2
      }, {
        name: '"Leebo"',
        id: 99,
        unique: true,
        slot: "Crew",
        points: 2,
        faction: "Rebel Alliance"
      }, {
        name: "Ruthlessness",
        id: 100,
        slot: "Elite",
        points: 3,
        faction: "Galactic Empire"
      }, {
        name: "Intimidation",
        id: 101,
        slot: "Elite",
        points: 2
      }, {
        name: "Ysanne Isard",
        id: 102,
        unique: true,
        slot: "Crew",
        points: 4,
        faction: "Galactic Empire"
      }, {
        name: "Moff Jerjerrod",
        id: 103,
        unique: true,
        slot: "Crew",
        points: 2,
        faction: "Galactic Empire"
      }, {
        name: "Ion Torpedoes",
        id: 104,
        slot: "Torpedo",
        points: 5,
        attack: 4,
        range: "2-3"
      }, {
        name: "Bodyguard",
        id: 105,
        unique: true,
        slot: "Elite",
        points: 2,
        faction: "Scum and Villainy"
      }, {
        name: "Calculation",
        id: 106,
        slot: "Elite",
        points: 1
      }, {
        name: "Accuracy Corrector",
        id: 107,
        slot: "System",
        points: 3
      }, {
        name: "Inertial Dampeners",
        id: 108,
        slot: "Illicit",
        points: 1
      }, {
        name: "Flechette Cannon",
        id: 109,
        slot: "Cannon",
        points: 2,
        attack: 3,
        range: "1-3"
      }, {
        name: '"Mangler" Cannon',
        id: 110,
        slot: "Cannon",
        points: 4,
        attack: 3,
        range: "1-3"
      }, {
        name: "Dead Man's Switch",
        id: 111,
        slot: "Illicit",
        points: 2
      }, {
        name: "Feedback Array",
        id: 112,
        slot: "Illicit",
        points: 2
      }, {
        name: '"Hot Shot" Blaster',
        id: 113,
        slot: "Illicit",
        points: 3,
        attack: 3,
        range: "1-2"
      }, {
        name: "Greedo",
        id: 114,
        unique: true,
        slot: "Crew",
        faction: "Scum and Villainy",
        points: 1
      }, {
        name: "Salvaged Astromech",
        id: 115,
        slot: "Salvaged Astromech",
        points: 2
      }, {
        name: "Bomb Loadout",
        id: 116,
        limited: true,
        slot: "Torpedo",
        points: 0,
        ship: "Y-Wing",
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Bomb"
          }
        ]
      }, {
        name: '"Genius"',
        id: 117,
        unique: true,
        slot: "Salvaged Astromech",
        points: 0
      }, {
        name: "Unhinged Astromech",
        id: 118,
        slot: "Salvaged Astromech",
        points: 1,
        modifier_func: function(stats) {
          var turn, _i, _ref, _results;
          if ((stats.maneuvers != null) && stats.maneuvers.length > 3) {
            _results = [];
            for (turn = _i = 0, _ref = stats.maneuvers[3].length; 0 <= _ref ? _i < _ref : _i > _ref; turn = 0 <= _ref ? ++_i : --_i) {
              if (stats.maneuvers[3][turn] > 0) {
                _results.push(stats.maneuvers[3][turn] = 2);
              } else {
                _results.push(void 0);
              }
            }
            return _results;
          }
        }
      }, {
        name: "R4-B11",
        id: 119,
        unique: true,
        slot: "Salvaged Astromech",
        points: 3
      }, {
        name: "Autoblaster Turret",
        id: 120,
        slot: "Turret",
        points: 2,
        attack: 2,
        range: "1"
      }, {
        name: "R4 Agromech",
        id: 121,
        slot: "Salvaged Astromech",
        points: 2
      }, {
        name: "K4 Security Droid",
        id: 122,
        slot: "Crew",
        faction: "Scum and Villainy",
        points: 3
      }, {
        name: "Outlaw Tech",
        id: 123,
        limited: true,
        slot: "Crew",
        faction: "Scum and Villainy",
        points: 2
      }, {
        name: 'Advanced Targeting Computer',
        canonical_name: 'Adv. Targeting Computer'.canonicalize(),
        id: 124,
        slot: "System",
        points: 5,
        ship: "TIE Advanced"
      }, {
        name: 'Ion Cannon Battery',
        id: 125,
        slot: "Hardpoint",
        points: 6,
        energy: 2,
        attack: 4,
        range: "2-4"
      }, {
        name: "Extra Munitions",
        id: 126,
        slot: "Torpedo",
        limited: true,
        points: 2
      }, {
        name: "Cluster Mines",
        id: 127,
        slot: "Bomb",
        points: 4
      }, {
        name: 'Glitterstim',
        id: 128,
        slot: "Illicit",
        points: 2
      }, {
        name: 'Grand Moff Tarkin',
        unique: true,
        id: 129,
        slot: "Crew",
        points: 6,
        faction: "Galactic Empire",
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.huge) != null ? _ref : false;
        }
      }, {
        name: 'Captain Needa',
        unique: true,
        id: 130,
        slot: "Crew",
        points: 2,
        faction: "Galactic Empire",
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.huge) != null ? _ref : false;
        }
      }, {
        name: 'Admiral Ozzel',
        unique: true,
        id: 131,
        slot: "Crew",
        points: 2,
        faction: "Galactic Empire",
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.huge) != null ? _ref : false;
        }
      }, {
        name: 'Emperor Palpatine',
        unique: true,
        id: 132,
        slot: "Crew",
        points: 8,
        faction: "Galactic Empire",
        restriction_func: function(ship, upgrade_obj) {
          return ship.hasAnotherUnoccupiedSlotLike(upgrade_obj);
        },
        validation_func: function(ship, upgrade_obj) {
          return upgrade_obj.occupiesAnotherUpgradeSlot();
        },
        also_occupies_upgrades: ["Crew"]
      }, {
        name: 'Bossk',
        unique: true,
        id: 133,
        faction: "Scum and Villainy",
        slot: "Crew",
        points: 2
      }, {
        name: "Lightning Reflexes",
        id: 134,
        slot: "Elite",
        points: 1,
        restriction_func: function(ship) {
          var _ref, _ref1;
          return !(((_ref = ship.data.large) != null ? _ref : false) || ((_ref1 = ship.data.huge) != null ? _ref1 : false));
        }
      }, {
        name: "Twin Laser Turret",
        id: 135,
        slot: "Turret",
        points: 6,
        attack: 3,
        range: "2-3"
      }, {
        name: "Plasma Torpedoes",
        id: 136,
        slot: "Torpedo",
        points: 3,
        attack: 4,
        range: "2-3"
      }, {
        name: "Ion Bombs",
        id: 137,
        slot: "Bomb",
        points: 2
      }, {
        name: "Conner Net",
        id: 138,
        slot: "Bomb",
        points: 4
      }, {
        name: "Bombardier",
        id: 139,
        slot: "Crew",
        points: 1
      }, {
        name: 'Crack Shot',
        id: 140,
        slot: 'Elite',
        points: 1
      }, {
        name: "Advanced Homing Missiles",
        canonical_name: 'Adv. Homing Missiles'.canonicalize(),
        id: 141,
        slot: "Missile",
        points: 3,
        attack: 3,
        range: "2"
      }, {
        name: 'Agent Kallus',
        id: 142,
        unique: true,
        points: 2,
        slot: 'Crew',
        faction: 'Galactic Empire'
      }, {
        name: 'XX-23 S-Thread Tracers',
        id: 143,
        points: 1,
        slot: 'Missile',
        attack: 3,
        range: '1-3'
      }, {
        name: "Tractor Beam",
        id: 144,
        slot: "Cannon",
        attack: 3,
        range: "1-3",
        points: 1
      }, {
        name: "Cloaking Device",
        id: 145,
        unique: true,
        slot: "Illicit",
        points: 2,
        restriction_func: function(ship) {
          var _ref, _ref1;
          return !(((_ref = ship.data.large) != null ? _ref : false) || ((_ref1 = ship.data.huge) != null ? _ref1 : false));
        }
      }, {
        name: 'Shield Technician',
        id: 146,
        slot: "Crew",
        points: 1,
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.huge) != null ? _ref : false;
        }
      }, {
        name: 'Weapons Guidance',
        id: 147,
        slot: "Tech",
        points: 2
      }, {
        name: 'BB-8',
        id: 148,
        unique: true,
        slot: "Astromech",
        points: 2
      }, {
        name: 'R5-X3',
        id: 149,
        unique: true,
        slot: "Astromech",
        points: 1
      }, {
        name: 'Wired',
        id: 150,
        slot: "Elite",
        points: 1
      }, {
        name: 'Cool Hand',
        id: 151,
        slot: 'Elite',
        points: 1
      }, {
        name: 'Juke',
        id: 152,
        slot: 'Elite',
        points: 2,
        restriction_func: function(ship) {
          var _ref, _ref1;
          return !(((_ref = ship.data.large) != null ? _ref : false) || ((_ref1 = ship.data.huge) != null ? _ref1 : false));
        }
      }, {
        name: 'Comm Relay',
        id: 153,
        slot: 'Tech',
        points: 3
      }, {
        name: 'Dual Laser Turret',
        id: 154,
        points: 5,
        slot: 'Hardpoint',
        attack: 3,
        range: '1-3',
        energy: 1,
        ship: 'Gozanti-class Cruiser'
      }, {
        name: 'Broadcast Array',
        id: 155,
        ship: 'Gozanti-class Cruiser',
        points: 2,
        slot: 'Cargo',
        modifier_func: function(stats) {
          if (__indexOf.call(stats.actions, 'Jam') < 0) {
            return stats.actions.push('Jam');
          }
        }
      }, {
        name: 'Rear Admiral Chiraneau',
        id: 156,
        unique: true,
        points: 3,
        slot: 'Crew',
        faction: 'Galactic Empire',
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.huge) != null ? _ref : false;
        }
      }, {
        name: 'Ordnance Experts',
        id: 157,
        limited: true,
        points: 5,
        slot: 'Team'
      }, {
        name: 'Docking Clamps',
        id: 158,
        points: 0,
        limited: true,
        slot: 'Cargo',
        ship: 'Gozanti-class Cruiser'
      }, {
        name: 'Kanan Jarrus',
        id: 159,
        unique: true,
        faction: 'Rebel Alliance',
        points: 3,
        slot: 'Crew'
      }, {
        name: '"Zeb" Orrelios',
        id: 160,
        unique: true,
        faction: 'Rebel Alliance',
        points: 1,
        slot: 'Crew'
      }, {
        name: 'Reinforced Deflectors',
        id: 161,
        points: 3,
        slot: 'System',
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.large) != null ? _ref : false;
        }
      }, {
        name: 'Dorsal Turret',
        id: 162,
        points: 3,
        slot: 'Turret',
        attack: 2,
        range: '1-2'
      }, {
        name: 'Targeting Astromech',
        id: 163,
        slot: 'Astromech',
        points: 2
      }, {
        name: 'Hera Syndulla',
        id: 164,
        unique: true,
        faction: 'Rebel Alliance',
        points: 1,
        slot: 'Crew'
      }, {
        name: 'Ezra Bridger',
        id: 165,
        unique: true,
        faction: 'Rebel Alliance',
        points: 3,
        slot: 'Crew'
      }, {
        name: 'Sabine Wren',
        id: 166,
        unique: true,
        faction: 'Rebel Alliance',
        points: 2,
        slot: 'Crew',
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Bomb"
          }
        ]
      }, {
        name: '"Chopper"',
        id: 167,
        unique: true,
        faction: 'Rebel Alliance',
        points: 0,
        slot: 'Crew'
      }, {
        name: 'Construction Droid',
        id: 168,
        points: 3,
        slot: 'Crew',
        limited: true,
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.huge) != null ? _ref : false;
        }
      }, {
        name: 'Cluster Bombs',
        id: 169,
        points: 4,
        slot: 'Cargo'
      }, {
        name: "Adaptability (+1)",
        id: 170,
        canonical_name: 'Adaptability'.canonicalize(),
        slot: "Elite",
        points: 0,
        modifier_func: function(stats) {
          return stats.skill += 1;
        }
      }, {
        name: "Adaptability (-1)",
        id: 171,
        canonical_name: 'Adaptability'.canonicalize(),
        slot: "Elite",
        points: 0,
        modifier_func: function(stats) {
          return stats.skill -= 1;
        }
      }, {
        name: "Electronic Baffle",
        id: 172,
        slot: "System",
        points: 1
      }, {
        name: "4-LOM",
        id: 173,
        unique: true,
        slot: "Crew",
        points: 1,
        faction: "Scum and Villainy"
      }, {
        name: "Zuckuss",
        id: 174,
        unique: true,
        slot: "Crew",
        points: 1,
        faction: "Scum and Villainy"
      }, {
        name: 'Rage',
        id: 175,
        points: 1,
        slot: 'Elite'
      }, {
        name: "Attanni Mindlink",
        id: 176,
        faction: "Scum and Villainy",
        slot: "Elite",
        points: 1
      }, {
        name: "Boba Fett",
        id: 177,
        unique: true,
        slot: "Crew",
        points: 1,
        faction: "Scum and Villainy"
      }, {
        name: "Dengar",
        id: 178,
        unique: true,
        slot: "Crew",
        points: 3,
        faction: "Scum and Villainy"
      }, {
        name: '"Gonk"',
        id: 179,
        unique: true,
        slot: "Crew",
        faction: "Scum and Villainy",
        points: 2
      }, {
        name: "R5-P8",
        id: 180,
        unique: true,
        slot: "Salvaged Astromech",
        points: 3
      }, {
        name: 'Thermal Detonators',
        id: 181,
        points: 3,
        slot: 'Bomb'
      }, {
        name: "Overclocked R4",
        id: 182,
        slot: "Salvaged Astromech",
        points: 1
      }
    ],
    modificationsById: [
      {
        name: "Zero modification",
        id: 0,
        skip: true
      }, {
        name: "Stealth Device",
        id: 1,
        points: 3,
        modifier_func: function(stats) {
          return stats.agility += 1;
        }
      }, {
        name: "Shield Upgrade",
        id: 2,
        points: 4,
        modifier_func: function(stats) {
          return stats.shields += 1;
        }
      }, {
        name: "Engine Upgrade",
        id: 3,
        points: 4,
        modifier_func: function(stats) {
          if (__indexOf.call(stats.actions, 'Boost') < 0) {
            return stats.actions.push('Boost');
          }
        }
      }, {
        name: "Anti-Pursuit Lasers",
        id: 4,
        points: 2,
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.large) != null ? _ref : false;
        }
      }, {
        name: "Targeting Computer",
        id: 5,
        points: 2,
        modifier_func: function(stats) {
          if (__indexOf.call(stats.actions, 'Target Lock') < 0) {
            return stats.actions.push('Target Lock');
          }
        }
      }, {
        name: "Hull Upgrade",
        id: 6,
        points: 3,
        modifier_func: function(stats) {
          return stats.hull += 1;
        }
      }, {
        name: "Munitions Failsafe",
        id: 7,
        points: 1
      }, {
        name: "Stygium Particle Accelerator",
        id: 8,
        points: 2
      }, {
        name: "Advanced Cloaking Device",
        id: 9,
        points: 4,
        ship: "TIE Phantom"
      }, {
        name: "Combat Retrofit",
        id: 10,
        points: 10,
        ship: "GR-75 Medium Transport",
        huge: true,
        modifier_func: function(stats) {
          stats.hull += 2;
          return stats.shields += 1;
        }
      }, {
        name: "B-Wing/E2",
        id: 11,
        points: 1,
        ship: "B-Wing",
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Crew"
          }
        ]
      }, {
        name: "Countermeasures",
        id: 12,
        points: 3,
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.large) != null ? _ref : false;
        }
      }, {
        name: "Experimental Interface",
        id: 13,
        unique: true,
        points: 3
      }, {
        name: "Tactical Jammer",
        id: 14,
        points: 1,
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.large) != null ? _ref : false;
        }
      }, {
        name: "Autothrusters",
        id: 15,
        points: 2,
        restriction_func: function(ship) {
          return __indexOf.call(ship.effectiveStats().actions, "Boost") >= 0;
        }
      }, {
        name: "Advanced SLAM",
        id: 16,
        points: 2
      }, {
        name: "Twin Ion Engine Mk. II",
        id: 17,
        points: 1,
        restriction_func: function(ship) {
          return ship.data.name.indexOf('TIE') !== -1;
        },
        modifier_func: function(stats) {
          var s, _i, _len, _ref, _ref1, _results;
          _ref1 = (_ref = stats.maneuvers) != null ? _ref : [];
          _results = [];
          for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
            s = _ref1[_i];
            if (s[1] !== 0) {
              s[1] = 2;
            }
            if (s[3] !== 0) {
              _results.push(s[3] = 2);
            } else {
              _results.push(void 0);
            }
          }
          return _results;
        }
      }, {
        name: "Maneuvering Fins",
        id: 18,
        points: 1,
        ship: "YV-666"
      }, {
        name: "Ion Projector",
        id: 19,
        points: 2,
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.large) != null ? _ref : false;
        }
      }, {
        name: 'Integrated Astromech',
        id: 20,
        restriction_func: function(ship) {
          return ship.data.canonical_name.indexOf('xwing') !== -1;
        },
        points: 0
      }, {
        name: 'Optimized Generators',
        id: 21,
        points: 5,
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.huge) != null ? _ref : false;
        }
      }, {
        name: 'Automated Protocols',
        id: 22,
        points: 5,
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.huge) != null ? _ref : false;
        }
      }, {
        name: 'Ordnance Tubes',
        id: 23,
        points: 5,
        slot: 'Hardpoint',
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.huge) != null ? _ref : false;
        }
      }, {
        name: 'Long-Range Scanners',
        id: 24,
        points: 0,
        restriction_func: function(ship) {
          var upgrade;
          return (((function() {
            var _i, _len, _ref, _results;
            _ref = ship.upgrades;
            _results = [];
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              upgrade = _ref[_i];
              if (upgrade.slot === 'Torpedo' && (upgrade.occupied_by == null)) {
                _results.push(upgrade);
              }
            }
            return _results;
          })()).length >= 1) && (((function() {
            var _i, _len, _ref, _results;
            _ref = ship.upgrades;
            _results = [];
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              upgrade = _ref[_i];
              if (upgrade.slot === 'Missile' && (upgrade.occupied_by == null)) {
                _results.push(upgrade);
              }
            }
            return _results;
          })()).length >= 1);
        }
      }, {
        name: "Guidance Chips",
        id: 25,
        points: 0
      }
    ],
    titlesById: [
      {
        name: "Zero Title",
        id: 0,
        skip: true
      }, {
        name: "Slave I",
        id: 1,
        unique: true,
        points: 0,
        ship: "Firespray-31",
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Torpedo"
          }
        ]
      }, {
        name: "Millennium Falcon",
        id: 2,
        unique: true,
        points: 1,
        ship: "YT-1300",
        actions: "Evade",
        modifier_func: function(stats) {
          if (__indexOf.call(stats.actions, 'Evade') < 0) {
            return stats.actions.push('Evade');
          }
        }
      }, {
        name: "Moldy Crow",
        id: 3,
        unique: true,
        points: 3,
        ship: "HWK-290"
      }, {
        name: "ST-321",
        id: 4,
        unique: true,
        points: 3,
        ship: "Lambda-Class Shuttle"
      }, {
        name: "Royal Guard TIE",
        id: 5,
        points: 0,
        ship: "TIE Interceptor",
        confersAddons: [
          {
            type: exportObj.Modification
          }
        ],
        restriction_func: function(ship) {
          return ship.effectiveStats().skill > 4;
        },
        special_case: 'Royal Guard TIE'
      }, {
        name: "Dodonna's Pride",
        id: 6,
        unique: true,
        points: 4,
        ship: "CR90 Corvette (Fore)"
      }, {
        name: "A-Wing Test Pilot",
        id: 7,
        points: 0,
        ship: "A-Wing",
        restriction_func: function(ship) {
          return ship.effectiveStats().skill > 1;
        },
        validation_func: function(ship, upgrade_obj) {
          var elite, elites, upgrade;
          if (!(ship.effectiveStats().skill > 1)) {
            return false;
          }
          elites = (function() {
            var _i, _len, _ref, _results;
            _ref = ship.upgrades;
            _results = [];
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              upgrade = _ref[_i];
              if (upgrade.slot === 'Elite' && (upgrade.data != null)) {
                _results.push(upgrade.data.canonical_name);
              }
            }
            return _results;
          })();
          while (elites.length > 0) {
            elite = elites.pop();
            if (__indexOf.call(elites, elite) >= 0) {
              return false;
            }
          }
          return true;
        },
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Elite"
          }
        ],
        special_case: "A-Wing Test Pilot"
      }, {
        name: "B-Wing/E",
        id: 8,
        skip: true,
        points: 99,
        ship: "B-Wing",
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Crew"
          }
        ]
      }, {
        name: "Tantive IV",
        id: 9,
        unique: true,
        points: 4,
        ship: "CR90 Corvette (Fore)",
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Crew"
          }, {
            type: exportObj.Upgrade,
            slot: "Team"
          }
        ]
      }, {
        name: "Bright Hope",
        id: 10,
        energy: "+2",
        unique: true,
        points: 5,
        ship: "GR-75 Medium Transport",
        modifier_func: function(stats) {
          return stats.energy += 2;
        }
      }, {
        name: "Quantum Storm",
        id: 11,
        energy: "+1",
        unique: true,
        points: 4,
        ship: "GR-75 Medium Transport",
        modifier_func: function(stats) {
          return stats.energy += 1;
        }
      }, {
        name: "Dutyfree",
        id: 12,
        energy: "+0",
        unique: true,
        points: 2,
        ship: "GR-75 Medium Transport"
      }, {
        name: "Jaina's Light",
        id: 13,
        unique: true,
        points: 2,
        ship: "CR90 Corvette (Fore)"
      }, {
        name: "Outrider",
        id: 14,
        unique: true,
        points: 5,
        ship: "YT-2400"
      }, {
        name: "Dauntless",
        id: 15,
        unique: true,
        points: 2,
        ship: "VT-49 Decimator"
      }, {
        name: "Virago",
        id: 16,
        unique: true,
        points: 1,
        ship: "StarViper",
        restriction_func: function(ship) {
          return ship.pilot.skill > 3;
        },
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "System"
          }, {
            type: exportObj.Upgrade,
            slot: "Illicit"
          }
        ]
      }, {
        name: '"Heavy Scyk" Interceptor (Cannon)',
        canonical_name: '"Heavy Scyk" Interceptor'.canonicalize(),
        id: 17,
        points: 2,
        ship: "M3-A Interceptor",
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Cannon"
          }
        ]
      }, {
        name: '"Heavy Scyk" Interceptor (Torpedo)',
        canonical_name: '"Heavy Scyk" Interceptor'.canonicalize(),
        id: 18,
        points: 2,
        ship: "M3-A Interceptor",
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Torpedo"
          }
        ]
      }, {
        name: '"Heavy Scyk" Interceptor (Missile)',
        canonical_name: '"Heavy Scyk" Interceptor'.canonicalize(),
        id: 19,
        points: 2,
        ship: "M3-A Interceptor",
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Missile"
          }
        ]
      }, {
        name: 'IG-2000',
        id: 20,
        points: 0,
        ship: "Aggressor"
      }, {
        name: "BTL-A4 Y-Wing",
        id: 21,
        points: 0,
        ship: "Y-Wing"
      }, {
        name: "Andrasta",
        id: 22,
        unique: true,
        points: 0,
        ship: "Firespray-31",
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Bomb"
          }, {
            type: exportObj.Upgrade,
            slot: "Bomb"
          }
        ]
      }, {
        name: 'TIE/x1',
        id: 23,
        points: 0,
        ship: "TIE Advanced",
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "System",
            adjustment_func: function(upgrade) {
              var copy;
              copy = $.extend(true, {}, upgrade);
              copy.points = Math.max(0, copy.points - 4);
              return copy;
            }
          }
        ]
      }, {
        name: "Hound's Tooth",
        id: 24,
        points: 6,
        unique: true,
        ship: "YV-666"
      }, {
        name: "Ghost",
        id: 25,
        unique: true,
        points: 0,
        ship: "VCX-100"
      }, {
        name: "Phantom",
        id: 26,
        unique: true,
        points: 0,
        ship: "Attack Shuttle"
      }, {
        name: "TIE/v1",
        id: 27,
        points: 1,
        ship: "TIE Advanced Prototype"
      }, {
        name: "Mist Hunter",
        id: 28,
        unique: true,
        points: 0,
        ship: "G-1A Starfighter",
        confersAddons: [
          {
            type: exportObj.RestrictedUpgrade,
            slot: "Cannon",
            filter_func: function(upgrade) {
              return upgrade.english_name === 'Tractor Beam';
            },
            auto_equip: 144
          }
        ],
        modifier_func: function(stats) {
          if (__indexOf.call(stats.actions, 'Barrel Roll') < 0) {
            return stats.actions.push('Barrel Roll');
          }
        }
      }, {
        name: "Punishing One",
        id: 29,
        unique: true,
        points: 12,
        ship: "JumpMaster 5000",
        modifier_func: function(stats) {
          return stats.attack += 1;
        }
      }, {
        name: 'Assailer',
        id: 30,
        points: 2,
        unique: true,
        ship: "Raider-class Corvette (Aft)"
      }, {
        name: 'Instigator',
        id: 31,
        points: 4,
        unique: true,
        ship: "Raider-class Corvette (Aft)"
      }, {
        name: 'Impetuous',
        id: 32,
        points: 3,
        unique: true,
        ship: "Raider-class Corvette (Aft)"
      }, {
        name: 'TIE/x7',
        id: 33,
        ship: 'TIE Defender',
        points: -2,
        unequips_upgrades: ['Cannon', 'Missile'],
        also_occupies_upgrades: ['Cannon', 'Missile']
      }, {
        name: 'TIE/D',
        id: 34,
        ship: 'TIE Defender',
        points: 0
      }, {
        name: 'TIE Shuttle',
        id: 35,
        ship: 'TIE Bomber',
        points: 0,
        unequips_upgrades: ['Torpedo', 'Torpedo', 'Missile', 'Missile', 'Bomb'],
        also_occupies_upgrades: ['Torpedo', 'Torpedo', 'Missile', 'Missile', 'Bomb'],
        confersAddons: [
          {
            type: exportObj.RestrictedUpgrade,
            slot: 'Crew',
            filter_func: function(upgrade) {
              return upgrade.points <= 4;
            }
          }, {
            type: exportObj.RestrictedUpgrade,
            slot: 'Crew',
            filter_func: function(upgrade) {
              return upgrade.points <= 4;
            }
          }
        ]
      }, {
        name: 'Requiem',
        id: 36,
        unique: true,
        ship: 'Gozanti-class Cruiser',
        energy: '+0',
        points: 4
      }, {
        name: 'Vector',
        id: 37,
        unique: true,
        ship: 'Gozanti-class Cruiser',
        energy: '+1',
        points: 2,
        modifier_func: function(stats) {
          return stats.energy += 1;
        }
      }, {
        name: 'Suppressor',
        id: 38,
        unique: true,
        ship: 'Gozanti-class Cruiser',
        energy: '+2',
        points: 6,
        modifier_func: function(stats) {
          return stats.energy += 2;
        }
      }
    ]
  };
};

exportObj.setupCardData = function(basic_cards, pilot_translations, upgrade_translations, modification_translations, title_translations) {
  var card, cards, e, expansion, field, i, modification, modification_data, modification_name, name, pilot, pilot_data, pilot_name, source, title, title_data, title_name, translation, translations, upgrade, upgrade_data, upgrade_name, _base, _base1, _base2, _base3, _base4, _base5, _base6, _base7, _i, _j, _k, _l, _len, _len1, _len10, _len11, _len12, _len2, _len3, _len4, _len5, _len6, _len7, _len8, _len9, _m, _n, _name, _name1, _name2, _name3, _name4, _name5, _o, _p, _q, _r, _ref, _ref1, _ref10, _ref11, _ref12, _ref13, _ref14, _ref15, _ref16, _ref17, _ref18, _ref19, _ref2, _ref20, _ref21, _ref22, _ref23, _ref24, _ref25, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8, _ref9, _s, _t, _u;
  _ref = basic_cards.pilotsById;
  for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
    pilot_data = _ref[i];
    if (pilot_data.id !== i) {
      throw new Error("ID mismatch: pilot at index " + i + " has ID " + pilot_data.id);
    }
  }
  _ref1 = basic_cards.upgradesById;
  for (i = _j = 0, _len1 = _ref1.length; _j < _len1; i = ++_j) {
    upgrade_data = _ref1[i];
    if (upgrade_data.id !== i) {
      throw new Error("ID mismatch: upgrade at index " + i + " has ID " + upgrade_data.id);
    }
  }
  _ref2 = basic_cards.titlesById;
  for (i = _k = 0, _len2 = _ref2.length; _k < _len2; i = ++_k) {
    title_data = _ref2[i];
    if (title_data.id !== i) {
      throw new Error("ID mismatch: title at index " + i + " has ID " + title_data.id);
    }
  }
  _ref3 = basic_cards.modificationsById;
  for (i = _l = 0, _len3 = _ref3.length; _l < _len3; i = ++_l) {
    modification_data = _ref3[i];
    if (modification_data.id !== i) {
      throw new Error("ID mismatch: modification at index " + i + " has ID " + modification_data.id);
    }
  }
  exportObj.pilots = {};
  _ref4 = basic_cards.pilotsById;
  for (_m = 0, _len4 = _ref4.length; _m < _len4; _m++) {
    pilot_data = _ref4[_m];
    if (pilot_data.skip == null) {
      pilot_data.sources = [];
      pilot_data.english_name = pilot_data.name;
      pilot_data.english_ship = pilot_data.ship;
      if (pilot_data.canonical_name == null) {
        pilot_data.canonical_name = pilot_data.english_name.canonicalize();
      }
      exportObj.pilots[pilot_data.name] = pilot_data;
    }
  }
  for (pilot_name in pilot_translations) {
    translations = pilot_translations[pilot_name];
    for (field in translations) {
      translation = translations[field];
      try {
        exportObj.pilots[pilot_name][field] = translation;
      } catch (_error) {
        e = _error;
        console.error("Cannot find translation for attribute " + field + " for pilot " + pilot_name);
        throw e;
      }
    }
  }
  exportObj.upgrades = {};
  _ref5 = basic_cards.upgradesById;
  for (_n = 0, _len5 = _ref5.length; _n < _len5; _n++) {
    upgrade_data = _ref5[_n];
    if (upgrade_data.skip == null) {
      upgrade_data.sources = [];
      upgrade_data.english_name = upgrade_data.name;
      if (upgrade_data.canonical_name == null) {
        upgrade_data.canonical_name = upgrade_data.english_name.canonicalize();
      }
      exportObj.upgrades[upgrade_data.name] = upgrade_data;
    }
  }
  for (upgrade_name in upgrade_translations) {
    translations = upgrade_translations[upgrade_name];
    for (field in translations) {
      translation = translations[field];
      try {
        exportObj.upgrades[upgrade_name][field] = translation;
      } catch (_error) {
        e = _error;
        console.error("Cannot find translation for attribute " + field + " for upgrade " + upgrade_name);
        throw e;
      }
    }
  }
  exportObj.modifications = {};
  _ref6 = basic_cards.modificationsById;
  for (_o = 0, _len6 = _ref6.length; _o < _len6; _o++) {
    modification_data = _ref6[_o];
    if (modification_data.skip == null) {
      modification_data.sources = [];
      modification_data.english_name = modification_data.name;
      if (modification_data.canonical_name == null) {
        modification_data.canonical_name = modification_data.english_name.canonicalize();
      }
      exportObj.modifications[modification_data.name] = modification_data;
    }
  }
  for (modification_name in modification_translations) {
    translations = modification_translations[modification_name];
    for (field in translations) {
      translation = translations[field];
      try {
        exportObj.modifications[modification_name][field] = translation;
      } catch (_error) {
        e = _error;
        console.error("Cannot find translation for attribute " + field + " for modification " + modification_name);
        throw e;
      }
    }
  }
  exportObj.titles = {};
  _ref7 = basic_cards.titlesById;
  for (_p = 0, _len7 = _ref7.length; _p < _len7; _p++) {
    title_data = _ref7[_p];
    if (title_data.skip == null) {
      title_data.sources = [];
      title_data.english_name = title_data.name;
      if (title_data.canonical_name == null) {
        title_data.canonical_name = title_data.english_name.canonicalize();
      }
      exportObj.titles[title_data.name] = title_data;
    }
  }
  for (title_name in title_translations) {
    translations = title_translations[title_name];
    for (field in translations) {
      translation = translations[field];
      try {
        exportObj.titles[title_name][field] = translation;
      } catch (_error) {
        e = _error;
        console.error("Cannot find translation for attribute " + field + " for title " + title_name);
        throw e;
      }
    }
  }
  _ref8 = exportObj.manifestByExpansion;
  for (expansion in _ref8) {
    cards = _ref8[expansion];
    for (_q = 0, _len8 = cards.length; _q < _len8; _q++) {
      card = cards[_q];
      if (card.skipForSource) {
        continue;
      }
      try {
        switch (card.type) {
          case 'pilot':
            exportObj.pilots[card.name].sources.push(expansion);
            break;
          case 'upgrade':
            exportObj.upgrades[card.name].sources.push(expansion);
            break;
          case 'modification':
            exportObj.modifications[card.name].sources.push(expansion);
            break;
          case 'title':
            exportObj.titles[card.name].sources.push(expansion);
            break;
          case 'ship':
            '';
            break;
          default:
            throw new Error("Unexpected card type " + card.type + " for card " + card.name + " of " + expansion);
        }
      } catch (_error) {
        e = _error;
        console.error("Error adding card " + card.name + " (" + card.type + ") from " + expansion);
      }
    }
  }
  _ref9 = exportObj.pilots;
  for (name in _ref9) {
    card = _ref9[name];
    card.sources = card.sources.sort();
  }
  _ref10 = exportObj.upgrades;
  for (name in _ref10) {
    card = _ref10[name];
    card.sources = card.sources.sort();
  }
  _ref11 = exportObj.modifications;
  for (name in _ref11) {
    card = _ref11[name];
    card.sources = card.sources.sort();
  }
  _ref12 = exportObj.titles;
  for (name in _ref12) {
    card = _ref12[name];
    card.sources = card.sources.sort();
  }
  exportObj.expansions = {};
  exportObj.pilotsById = {};
  exportObj.pilotsByLocalizedName = {};
  _ref13 = exportObj.pilots;
  for (pilot_name in _ref13) {
    pilot = _ref13[pilot_name];
    exportObj.fixIcons(pilot);
    exportObj.pilotsById[pilot.id] = pilot;
    exportObj.pilotsByLocalizedName[pilot.name] = pilot;
    _ref14 = pilot.sources;
    for (_r = 0, _len9 = _ref14.length; _r < _len9; _r++) {
      source = _ref14[_r];
      if (!(source in exportObj.expansions)) {
        exportObj.expansions[source] = 1;
      }
    }
  }
  if (Object.keys(exportObj.pilotsById).length !== Object.keys(exportObj.pilots).length) {
    throw new Error("At least one pilot shares an ID with another");
  }
  exportObj.pilotsByFactionCanonicalName = {};
  _ref15 = exportObj.pilots;
  for (pilot_name in _ref15) {
    pilot = _ref15[pilot_name];
    ((_base = ((_base1 = exportObj.pilotsByFactionCanonicalName)[_name1 = pilot.faction] != null ? _base1[_name1] : _base1[_name1] = {}))[_name = pilot.canonical_name] != null ? _base[_name] : _base[_name] = []).push(pilot);
    switch (pilot.faction) {
      case 'Resistance':
        ((_base2 = ((_base3 = exportObj.pilotsByFactionCanonicalName)['Rebel Alliance'] != null ? _base3['Rebel Alliance'] : _base3['Rebel Alliance'] = {}))[_name2 = pilot.canonical_name] != null ? _base2[_name2] : _base2[_name2] = []).push(pilot);
        break;
      case 'First Order':
        ((_base4 = ((_base5 = exportObj.pilotsByFactionCanonicalName)['Galactic Empire'] != null ? _base5['Galactic Empire'] : _base5['Galactic Empire'] = {}))[_name3 = pilot.canonical_name] != null ? _base4[_name3] : _base4[_name3] = []).push(pilot);
    }
  }
  exportObj.upgradesById = {};
  exportObj.upgradesByLocalizedName = {};
  _ref16 = exportObj.upgrades;
  for (upgrade_name in _ref16) {
    upgrade = _ref16[upgrade_name];
    exportObj.fixIcons(upgrade);
    exportObj.upgradesById[upgrade.id] = upgrade;
    exportObj.upgradesByLocalizedName[upgrade.name] = upgrade;
    _ref17 = upgrade.sources;
    for (_s = 0, _len10 = _ref17.length; _s < _len10; _s++) {
      source = _ref17[_s];
      if (!(source in exportObj.expansions)) {
        exportObj.expansions[source] = 1;
      }
    }
  }
  if (Object.keys(exportObj.upgradesById).length !== Object.keys(exportObj.upgrades).length) {
    throw new Error("At least one upgrade shares an ID with another");
  }
  exportObj.upgradesBySlotCanonicalName = {};
  _ref18 = exportObj.upgrades;
  for (upgrade_name in _ref18) {
    upgrade = _ref18[upgrade_name];
    ((_base6 = exportObj.upgradesBySlotCanonicalName)[_name4 = upgrade.slot] != null ? _base6[_name4] : _base6[_name4] = {})[upgrade.canonical_name] = upgrade;
  }
  exportObj.modificationsById = {};
  exportObj.modificationsByLocalizedName = {};
  _ref19 = exportObj.modifications;
  for (modification_name in _ref19) {
    modification = _ref19[modification_name];
    exportObj.fixIcons(modification);
    if (modification.huge != null) {
      if (modification.restriction_func == null) {
        modification.restriction_func = exportObj.hugeOnly;
      }
    } else if (modification.restriction_func == null) {
      modification.restriction_func = function(ship) {
        var _ref20;
        return !((_ref20 = ship.data.huge) != null ? _ref20 : false);
      };
    }
    exportObj.modificationsById[modification.id] = modification;
    exportObj.modificationsByLocalizedName[modification.name] = modification;
    _ref20 = modification.sources;
    for (_t = 0, _len11 = _ref20.length; _t < _len11; _t++) {
      source = _ref20[_t];
      if (!(source in exportObj.expansions)) {
        exportObj.expansions[source] = 1;
      }
    }
  }
  if (Object.keys(exportObj.modificationsById).length !== Object.keys(exportObj.modifications).length) {
    throw new Error("At least one modification shares an ID with another");
  }
  exportObj.modificationsByCanonicalName = {};
  _ref21 = exportObj.modifications;
  for (modification_name in _ref21) {
    modification = _ref21[modification_name];
    (exportObj.modificationsByCanonicalName != null ? exportObj.modificationsByCanonicalName : exportObj.modificationsByCanonicalName = {})[modification.canonical_name] = modification;
  }
  exportObj.titlesById = {};
  exportObj.titlesByLocalizedName = {};
  _ref22 = exportObj.titles;
  for (title_name in _ref22) {
    title = _ref22[title_name];
    exportObj.fixIcons(title);
    exportObj.titlesById[title.id] = title;
    exportObj.titlesByLocalizedName[title.name] = title;
    _ref23 = title.sources;
    for (_u = 0, _len12 = _ref23.length; _u < _len12; _u++) {
      source = _ref23[_u];
      if (!(source in exportObj.expansions)) {
        exportObj.expansions[source] = 1;
      }
    }
  }
  if (Object.keys(exportObj.titlesById).length !== Object.keys(exportObj.titles).length) {
    throw new Error("At least one title shares an ID with another");
  }
  exportObj.titlesByShip = {};
  _ref24 = exportObj.titles;
  for (title_name in _ref24) {
    title = _ref24[title_name];
    if (!(title.ship in exportObj.titlesByShip)) {
      exportObj.titlesByShip[title.ship] = [];
    }
    exportObj.titlesByShip[title.ship].push(title);
  }
  exportObj.titlesByCanonicalName = {};
  _ref25 = exportObj.titles;
  for (title_name in _ref25) {
    title = _ref25[title_name];
    if (title.canonical_name === '"Heavy Scyk" Interceptor'.canonicalize()) {
      ((_base7 = (exportObj.titlesByCanonicalName != null ? exportObj.titlesByCanonicalName : exportObj.titlesByCanonicalName = {}))[_name5 = title.canonical_name] != null ? _base7[_name5] : _base7[_name5] = []).push(title);
    } else {
      (exportObj.titlesByCanonicalName != null ? exportObj.titlesByCanonicalName : exportObj.titlesByCanonicalName = {})[title.canonical_name] = title;
    }
  }
  return exportObj.expansions = Object.keys(exportObj.expansions).sort();
};

exportObj.fixIcons = function(data) {
  if (data.text != null) {
    return data.text = data.text.replace(/%ASTROMECH%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-astromech"></i>').replace(/%BANKLEFT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-bankleft"></i>').replace(/%BANKRIGHT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-bankright"></i>').replace(/%BARRELROLL%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-barrelroll"></i>').replace(/%BOMB%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-bomb"></i>').replace(/%BOOST%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-boost"></i>').replace(/%CANNON%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-cannon"></i>').replace(/%CARGO%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-cargo"></i>').replace(/%CLOAK%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-cloak"></i>').replace(/%COORDINATE%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-coordinate"></i>').replace(/%CRIT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-crit"></i>').replace(/%CREW%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-crew"></i>').replace(/%ELITE%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-elite"></i>').replace(/%EVADE%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-evade"></i>').replace(/%FOCUS%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-focus"></i>').replace(/%HARDPOINT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-hardpoint"></i>').replace(/%HIT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-hit"></i>').replace(/%ILLICIT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-illicit"></i>').replace(/%JAM%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-jam"></i>').replace(/%KTURN%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-kturn"></i>').replace(/%MISSILE%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-missile"></i>').replace(/%RECOVER%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-recover"></i>').replace(/%REINFORCE%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-reinforce"></i>').replace(/%SALVAGEDASTROMECH%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-salvagedastromech"></i>').replace(/%SLOOPLEFT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-sloopleft"></i>').replace(/%SLOOPRIGHT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-sloopright"></i>').replace(/%STRAIGHT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-straight"></i>').replace(/%STOP%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-stop"></i>').replace(/%SYSTEM%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-system"></i>').replace(/%TARGETLOCK%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-targetlock"></i>').replace(/%TEAM%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-team"></i>').replace(/%TECH%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-tech"></i>').replace(/%TORPEDO%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-torpedo"></i>').replace(/%TROLLLEFT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-trollleft"></i>').replace(/%TROLLRIGHT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-trollright"></i>').replace(/%TURNLEFT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-turnleft"></i>').replace(/%TURNRIGHT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-turnright"></i>').replace(/%TURRET%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-turret"></i>').replace(/%UTURN%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-kturn"></i>').replace(/%HUGESHIPONLY%/g, '<span class="card-restriction">Huge ship only.</span>').replace(/%LARGESHIPONLY%/g, '<span class="card-restriction">Large ship only.</span>').replace(/%SMALLSHIPONLY%/g, '<span class="card-restriction">Small ship only.</span>').replace(/%REBELONLY%/g, '<span class="card-restriction">Rebel only.</span>').replace(/%IMPERIALONLY%/g, '<span class="card-restriction">Imperial only.</span>').replace(/%SCUMONLY%/g, '<span class="card-restriction">Scum only.</span>').replace(/%LIMITED%/g, '<span class="card-restriction">Limited.</span>').replace(/%LINEBREAK%/g, '<br /><br />').replace(/%DE_HUGESHIPONLY%/g, '<span class="card-restriction">Nur für riesige Schiffe.</span>').replace(/%DE_LARGESHIPONLY%/g, '<span class="card-restriction">Nur für grosse Schiffe.</span>').replace(/%DE_REBELONLY%/g, '<span class="card-restriction">Nur für Rebellen.</span>').replace(/%DE_IMPERIALONLY%/g, '<span class="card-restriction">Nur für das Imperium.</span>').replace(/%DE_SCUMONLY%/g, '<span class="card-restriction">Nur für Abschaum & Kriminelle.</span>').replace(/%DE_GOZANTIONLY%/g, '<span class="card-restriction">Nur für Kreuzer der <em>Gozanti</em>-Klasse.</span>').replace(/%DE_LIMITED%/g, '<span class="card-restriction">Limitiert.</span>').replace(/%FR_HUGESHIPONLY%/g, '<span class="card-restriction">Vaisseau immense uniquement.</span>').replace(/%FR_LARGESHIPONLY%/g, '<span class="card-restriction">Grand vaisseau uniquement.</span>').replace(/%FR_REBELONLY%/g, '<span class="card-restriction">Rebelle uniquement.</span>').replace(/%FR_IMPERIALONLY%/g, '<span class="card-restriction">Impérial uniquement.</span>').replace(/%FR_SCUMONLY%/g, '<span class="card-restriction">Racailles uniquement.</span>').replace(/%GOZANTIONLY%/g, '<span class="card-restriction"><em>Gozanti</em>-class cruiser only.</span>');
  }
};

exportObj.canonicalizeShipNames = function(card_data) {
  var ship_data, ship_name, _ref, _results;
  _ref = card_data.ships;
  _results = [];
  for (ship_name in _ref) {
    ship_data = _ref[ship_name];
    ship_data.english_name = ship_name;
    _results.push(ship_data.canonical_name != null ? ship_data.canonical_name : ship_data.canonical_name = ship_data.english_name.canonicalize());
  }
  return _results;
};

exportObj.renameShip = function(english_name, new_name) {
  exportObj.ships[new_name] = exportObj.ships[english_name];
  exportObj.ships[new_name].name = new_name;
  return delete exportObj.ships[english_name];
};

exportObj = typeof exports !== "undefined" && exports !== null ? exports : this;

if (exportObj.codeToLanguage == null) {
  exportObj.codeToLanguage = {};
}

exportObj.codeToLanguage.de = 'Deutsch';

if (exportObj.translations == null) {
  exportObj.translations = {};
}

exportObj.translations.Deutsch = {
  action: {
    "Barrel Roll": "Fassrolle",
    "Boost": "Schub",
    "Evade": "Ausweichen",
    "Focus": "Fokussierung",
    "Target Lock": "Zielerfassung",
    "Recover": "Aufladen",
    "Reinforce": "Verstärken",
    "Jam": "Störsignal",
    "Coordinate": "Koordination",
    "SLAM": "SLAM",
    "Cloak": "Tarnen"
  },
  slot: {
    "Astromech": "Astromech",
    "Bomb": "Bombe",
    "Cannon": "Kanonen",
    "Crew": "Crew",
    "Elite": "Elite",
    "Missile": "Raketen",
    "System": "System",
    "Torpedo": "Torpedo",
    "Turret": "Geschützturm",
    "Cargo": "Fracht",
    "Hardpoint": "Hardpoint",
    "Team": "Team",
    "Illicit": "Illegales",
    "Salvaged Astromech": "geborgener Astromech"
  },
  sources: {
    "Core": "Grundspiel",
    "A-Wing Expansion Pack": "A-Wing Erweiterung",
    "B-Wing Expansion Pack": "B-Wing Erweiterung",
    "X-Wing Expansion Pack": "X-Wing Erweiterung",
    "Y-Wing Expansion Pack": "Y-Wing Erweiterung",
    "Millennium Falcon Expansion Pack": "Millenium Falke Erweiterung",
    "HWK-290 Expansion Pack": "HWK-290 Erweiterung",
    "TIE Fighter Expansion Pack": "TIE-Jäger Erweiterung",
    "TIE Interceptor Expansion Pack": "TIE-Abfangjäger Erweiterung",
    "TIE Bomber Expansion Pack": "TIE-Bomber Erweiterung",
    "TIE Advanced Expansion Pack": "TIE-Advanced Erweiterung",
    "Lambda-Class Shuttle Expansion Pack": "Raumfähre der Lambda-Klasse Erweiterung",
    "Slave I Expansion Pack": "Sklave I Erweiterung",
    "Imperial Aces Expansion Pack": "Fliegerasse des Imperiums Erweiterung",
    "Rebel Transport Expansion Pack": "Rebellentransporter Erweiterung",
    "Z-95 Headhunter Expansion Pack": "Z-95-Kopfjäger Erweiterung",
    "TIE Defender Expansion Pack": "TIE-Jagdbomber Erweiterung",
    "E-Wing Expansion Pack": "E-Wing Erweiterung",
    "TIE Phantom Expansion Pack": "TIE-Phantom Erweiterung",
    "Tantive IV Expansion Pack": "Tantive IV Erweiterung",
    "Rebel Aces Expansion Pack": "Fliegerasse der Rebellenallianz Erweiterung",
    "YT-2400 Freighter Expansion Pack": "YT-2400-Frachter Erweiterung",
    "VT-49 Decimator Expansion Pack": "VT-49 Decimator Erweiterung",
    "StarViper Expansion Pack": "SternenViper Erweiterung",
    "M3-A Interceptor Expansion Pack": "M3-A Abfangjäger Erweiterung",
    "IG-2000 Expansion Pack": "IG-2000 Erweiterung",
    "Most Wanted Expansion Pack": "Abschaum und Kriminelle Erweiterung",
    "Imperial Raider Expansion Pack": "Imperiale Sturm-Korvette Erweiterung",
    "Hound's Tooth Expansion Pack": "Reisszahn Erweiterung",
    "Kihraxz Fighter Expansion Pack": "Kihraxz-Jäger Erweiterung",
    "K-Wing Expansion Pack": "K-Wing Erweiterung",
    "TIE Punisher Expansion Pack": "TIE-Vergelter Erweiterung",
    "The Force Awakens Core Set": "Das Erwachen der Macht Grundspiel",
    "Imperial Assault Carrier Expansion Pack": "Imperialer Angriffsträger Erweiterung",
    "T-70 X-Wing Expansion Pack": "T-70-X-Flügler Erweiterung",
    "TIE/fo Fighter Expansion Pack": "TIE/EO-Jäger Erweiterung"
  },
  ui: {
    shipSelectorPlaceholder: "Wähle ein Schiff",
    pilotSelectorPlaceholder: "Wähle einen Piloten",
    upgradePlaceholder: function(translator, language, slot) {
      return "kein " + (translator(language, 'slot', slot)) + " Upgrade";
    },
    modificationPlaceholder: "keine Modifikation",
    titlePlaceholder: "kein Titel",
    upgradeHeader: function(translator, language, slot) {
      return "" + (translator(language, 'slot', slot)) + " Upgrade";
    },
    unreleased: "unveröffentlicht",
    epic: "Episch",
    limited: "limitiert"
  },
  byCSSSelector: {
    '.translate.sort-cards-by': 'Sortiere Karten nach',
    '.xwing-card-browser option[value="name"]': 'Name',
    '.xwing-card-browser option[value="source"]': 'Quelle',
    '.xwing-card-browser option[value="type-by-points"]': 'Typ (Punkte)',
    '.xwing-card-browser option[value="type-by-name"]': 'Typ (Name)',
    '.xwing-card-browser .translate.select-a-card': 'Wähle eine Karte aus der Liste.',
    '.xwing-card-browser .info-range td': 'Reichweite',
    '.info-well .info-ship td.info-header': 'Schiff',
    '.info-well .info-skill td.info-header': 'Pilotenwert',
    '.info-well .info-actions td.info-header': 'Aktionen',
    '.info-well .info-upgrades td.info-header': 'Aufwertungen',
    '.info-well .info-range td.info-header': 'Reichweite',
    '.clear-squad': 'Neue Staffel',
    '.save-list': 'Speichern',
    '.save-list-as': 'Speichern als…',
    '.delete-list': 'Löschen',
    '.backend-list-my-squads': 'Staffel laden',
    '.view-as-text': '<span class="hidden-phone"><i class="icon-print"></i>&nbsp;Drucken/Anzeigen als </span>Text',
    '.collection': '<span class="hidden-phone"><i class="icon-folder-open hidden-phone hidden-tabler"></i>&nbsp;Deine Sammlung</span>',
    '.randomize': 'Zufallsliste!',
    '.randomize-options': 'Zufallslisten-Optionen…',
    '.notes-container > span': 'Staffelnotizen',
    '.bbcode-list': 'Kopiere den BBCode von unten und füge ihn in deine Forenposts ein.<textarea></textarea>',
    '.vertical-space-checkbox': "Platz für Schadenskarten und Aufwertungen im Druck berücksichtigen. <input type=\"checkbox\" class=\"toggle-vertical-space\" />",
    '.color-print-checkbox': "Ausdrucken in Farbe. <input type=\"checkbox\" class=\"toggle-color-print\" />",
    '.print-list': '<i class="icon-print"></i>&nbsp;Druck',
    '.do-randomize': 'Zufall!',
    '#empireTab': 'Galaktisches Imperium',
    '#rebelTab': 'Rebellen Allianz',
    '#scumTab': 'Abschaum und Kriminelle',
    '#browserTab': 'Karten Browser',
    '#aboutTab': 'Über',
    '.from-xws': 'Import von XWS (beta)',
    '.to-xws': 'Export nach XWS (beta)'
  },
  singular: {
    'pilots': 'Pilot',
    'modifications': 'Modifikation',
    'titles': 'Titel'
  },
  types: {
    'Pilot': 'Pilot',
    'Modification': 'Modifikation',
    'Title': 'Titel'
  }
};

if (exportObj.cardLoaders == null) {
  exportObj.cardLoaders = {};
}

exportObj.cardLoaders.Deutsch = function() {
  var basic_cards, modification_translations, pilot_translations, title_translations, upgrade_translations;
  exportObj.cardLanguage = 'Deutsch';
  basic_cards = exportObj.basicCardData();
  exportObj.canonicalizeShipNames(basic_cards);
  exportObj.ships = basic_cards.ships;
  exportObj.renameShip('TIE Fighter', 'TIE-Jäger');
  exportObj.renameShip('TIE Interceptor', 'TIE-Abfangjäger');
  exportObj.renameShip('TIE Bomber', 'TIE-Bomber');
  exportObj.renameShip('Z-95 Headhunter', 'Z-95-Kopfjäger');
  exportObj.renameShip('TIE Defender', 'TIE-Jagdbomber');
  exportObj.renameShip('Lambda-Class Shuttle', 'Raumfähre der Lambda-Klasse');
  exportObj.renameShip('GR-75 Medium Transport', 'Medium-Transporter GR-75');
  exportObj.renameShip('CR90 Corvette (Fore)', 'CR90-Korvette (Bug)');
  exportObj.renameShip('CR90 Corvette (Aft)', 'CR90-Korvette (Heck)');
  exportObj.renameShip('M3-A Interceptor', 'M3-A Abfangjäger');
  exportObj.renameShip('Raider-class Corvette (Fore)', 'Korv. der Sturm-Klasse (Bug)');
  exportObj.renameShip('Raider-class Corvette (Aft)', 'Korv. der Sturm-Klasse (Heck)');
  exportObj.renameShip('TIE Phantom', 'TIE-Phantom');
  exportObj.renameShip('Kihraxz Fighter', 'Kihraxz-Jäger');
  exportObj.renameShip('TIE Punisher', 'TIE-Vergelter');
  exportObj.renameShip('StarViper', 'SternenViper');
  exportObj.renameShip('T-70 X-Wing', 'T-70-X-Flügler');
  exportObj.renameShip('TIE/fo Fighter', 'TIE/EO-Jäger');
  exportObj.renameShip('Gozanti-class Cruiser', 'Kreuzer der Gozanti-Klasse');
  pilot_translations = {
    "Wedge Antilles": {
      text: "Wenn du angreifst, sinkt der Wendigkeitswert des Verteidigers um 1 (Minimum 0)."
    },
    "Garven Dreis": {
      text: "Wenn du einen Fokusmarker ausgibst, darfst du ihn auf ein anderes freundliches Schiff in Reichweite 1-2 legen (anstatt ihn abzulegen)."
    },
    "Red Squadron Pilot": {
      name: "Pilot der Rot-Staffel"
    },
    "Rookie Pilot": {
      name: "Anfängerpilot"
    },
    "Biggs Darklighter": {
      text: "Andere freundliche Schiffe in Reichweite 1 dürfen nur dann angegriffen werden, wenn der Angreifer dich nicht zum Ziel bestimmen kann."
    },
    "Luke Skywalker": {
      text: "Wenn du verteidigst, kannst du 1 deiner %FOCUS% in ein %EVADE% ändern."
    },
    "Gray Squadron Pilot": {
      name: "Pilot der Grau-Staffel"
    },
    '"Dutch" Vander': {
      text: "Wähle ein anderes freundliches Schiff in Reichweite 1-2, nachdem du eine Zielerfassung durchgeführt hast. Das gewählte Schiff darf sofort ebenfalls eine Zielerfassung durchführen."
    },
    "Horton Salm": {
      text: "Wenn du ein Ziel in Reichweite 2-3 angreifst, darfst du beliebig viele Leerseiten neu würfeln."
    },
    "Gold Squadron Pilot": {
      name: "Pilot der Gold-Staffel"
    },
    "Academy Pilot": {
      ship: "TIE-Jäger",
      name: "Pilot der Akademie"
    },
    "Obsidian Squadron Pilot": {
      ship: "TIE-Jäger",
      name: "Pilot der Obsidian-Staffel"
    },
    "Black Squadron Pilot": {
      ship: "TIE-Jäger",
      name: "Pilot der Schwarz-Staffel"
    },
    '"Winged Gundark"': {
      ship: "TIE-Jäger",
      name: '"Geflügelter Gundark"',
      text: "Wenn du ein Ziel in Reichweite 1 angreifst, darfst du eines deiner %HIT% in ein %CRIT% ändern."
    },
    '"Night Beast"': {
      name: '"Nachtbestie"',
      ship: "TIE-Jäger",
      text: "Nachdem du ein grünes Manöver ausgeführt hast, darfst du als freie Aktion eine Fokussierung durchführen."
    },
    '"Backstabber"': {
      ship: "TIE-Jäger",
      text: "Wenn du bei deinem Angriff nicht im Feuerwinkel des Verteidigers bist, erhältst du 1 zusätzlichen Angriffswürfel."
    },
    '"Dark Curse"': {
      ship: "TIE-Jäger",
      text: "Wenn du verteidigst, können angreifende Schiffe keine Fokusmarker ausgeben oder Angriffswürfel neu würfeln."
    },
    '"Mauler Mithel"': {
      ship: "TIE-Jäger",
      text: "Wirf 1 zusätzlichen Angriffswürfel, wenn du ein Ziel in Reichweite 1 angreifst."
    },
    '"Howlrunner"': {
      ship: "TIE-Jäger",
      name: '"Kreischläufer"',
      text: "Wenn ein anderes freundliches Schiff in Reichweite 1 mit seinen Primärwaffen angreift, darf es 1 Angriffswürfel neu würfeln."
    },
    "Maarek Stele": {
      text: "Wenn ein Verteidiger durch deinen Angriff eine offene Schadenskarte erhalten würde, ziehst du stattdessen 3 Schadenskarten, wählst eine davon zum Austeilen und legst die restlichen ab."
    },
    "Tempest Squadron Pilot": {
      name: "Pilot der Tornado-Staffel"
    },
    "Storm Squadron Pilot": {
      name: "Pilot der Storm-Staffel"
    },
    "Darth Vader": {
      text: "Im Schritt \"Aktionen durchführen\" darfst du 2 Aktionen durchführen."
    },
    "Alpha Squadron Pilot": {
      name: "Pilot der Alpha-Staffel",
      ship: "TIE-Abfangjäger"
    },
    "Avenger Squadron Pilot": {
      name: "Pilot der Avenger-Staffel",
      ship: "TIE-Abfangjäger"
    },
    "Saber Squadron Pilot": {
      name: "Pilot der Saber-Staffel",
      ship: "TIE-Abfangjäger"
    },
    "\"Fel's Wrath\"": {
      ship: "TIE-Abfangjäger",
      text: "Wenn die Summe deiner Schadenskarten deinen Hüllenwert erreicht oder übersteigt, wirst du nicht sofort zerstört, sondern erst am Ende der Kampfphase."
    },
    "Turr Phennir": {
      ship: "TIE-Abfangjäger",
      text: "Nachdem du angegriffen hast, darfst du eine freie Aktion Schub oder Fassrolle durchführen."
    },
    "Soontir Fel": {
      ship: "TIE-Abfangjäger",
      text: "Immer wenn du einen Stressmarker erhältst, darfst du deinem Schiff auch einen Fokusmarker geben."
    },
    "Tycho Celchu": {
      text: "Du darfst auch dann Aktionen durchführen, wenn du Stressmarker hast."
    },
    "Arvel Crynyd": {
      text: "Wenn du angreifst, darfst du auch auf feindliche Schiffe zielen, deren Basen du berührst (vorausgesetzt sie sind innerhalb deines Feuerwinkels)."
    },
    "Green Squadron Pilot": {
      name: "Pilot der Grün-Staffel"
    },
    "Prototype Pilot": {
      name: "Testpilot"
    },
    "Outer Rim Smuggler": {
      name: "Schmuggler aus dem Outer Rim"
    },
    "Chewbacca": {
      text: "Wenn du eine offene Schadenskarte erhältst, wird sie sofort umgedreht (ohne dass ihr Kartentext in Kraft tritt)."
    },
    "Lando Calrissian": {
      text: "Wähle nach dem Ausführen eines grünen Manövers ein anderes freundliches Schiff in Reichweite 1. Dieses Schiff darf eine freie Aktion aus seiner Aktionsleiste durchführen."
    },
    "Han Solo": {
      text: "Wenn du angreifst, darfst du all deine Würfel neu würfeln. Tust du dies, musst du so viele Würfel wie möglich neu würfeln."
    },
    "Kath Scarlet": {
      text: "Wenn du angreifst und der Verteidiger mindestens 1 %CRIT% negiert, erhält er 1 Stressmarker."
    },
    "Boba Fett": {
      text: "Sobald du ein Drehmanöver (%BANKLEFT% oder %BANKRIGHT%) aufdeckst, darfst du das Drehmanöver mit gleicher eschwindigkeit, aber anderer Richtung, auf deinem Rad nachträglich einstellen."
    },
    "Krassis Trelix": {
      text: "Wenn du mit einer Sekundärwaffe angreifst, darfst du 1 Angriffswürfel neu würfeln."
    },
    "Bounty Hunter": {
      name: "Kopfgeldjäger"
    },
    "Ten Numb": {
      text: "Wenn du angreifst, kann 1 deiner %CRIT% von Verteidigungswürfeln nicht negiert werden."
    },
    "Ibtisam": {
      text: "Beim Angreifen oder Verteidigen darfst du 1 deiner Würfel neu würfeln, sofern du mindestens 1 Stressmarker hast."
    },
    "Dagger Squadron Pilot": {
      name: "Pilot der Dagger-Staffel"
    },
    "Blue Squadron Pilot": {
      name: "Pilot der Blauen Staffel"
    },
    "Rebel Operative": {
      name: "Rebellenagent"
    },
    "Roark Garnet": {
      text: 'Wähle zu Beginn der Kampfphase 1 anderes freundliches Schiff in Reichweite 1-3. Bis zum Ende der Phase wird dieses Schiff behandelt, als hätte es einen Pilotenwert von 12.'
    },
    "Kyle Katarn": {
      text: "Zu Beginn der Kampfphase darfst du einem anderen freundlichen Schiff in Reichweite 1-3 einen deiner Fokusmarker geben."
    },
    "Jan Ors": {
      text: "Wenn ein anderes freundliches Schiff in Reichweite 1-3 angreift und du keine Stressmarker hast, darfst du 1 Stressmarker nehmen, damit dieses Schiff 1 zusätzlichen Angriffswürfel erhält."
    },
    "Scimitar Squadron Pilot": {
      ship: "TIE-Bomber",
      name: "Pilot der Scimitar-Staffel"
    },
    "Gamma Squadron Pilot": {
      ship: "TIE-Bomber",
      name: "Pilot der Gamma-Staffel"
    },
    "Captain Jonus": {
      ship: "TIE-Bomber",
      text: "Wenn ein anderes freundliches Schiff in Reichweite 1 mit einer Sekundärwaffe angreift, darf es bis zu 2 Angriffswürfel neu würfeln."
    },
    "Major Rhymer": {
      ship: "TIE-Bomber",
      text: "Beim Angreifen mit einer Sekundärwaffe darfst du die Reichweite der Waffe um 1 erhöhen oder verringern, bis zu einer Reichweite von 1-3."
    },
    "Captain Kagi": {
      ship: "Raumfähre der Lambda-Klasse",
      text: "Wenn ein feindliches Schiff eine Zielerfassung durchführt, muss es wenn möglich dich als Ziel erfassen."
    },
    "Colonel Jendon": {
      ship: "Raumfähre der Lambda-Klasse",
      text: "Zu Beginn der Kampfphase darfst du 1 deiner blauen Zielerfassungsmarker auf ein freundliches Schiff in Reichweite 1 legen, das noch keinen blauen Zielerfassungsmarker hat."
    },
    "Captain Yorr": {
      ship: "Raumfähre der Lambda-Klasse",
      text: "Wenn ein anderes freundliches Schiff in Reichweite 1-2 einen Stressmarker erhalten würde und du 2 oder weniger Stressmarker hast, darfst du statt ihm diesen Marker nehmen."
    },
    "Omicron Group Pilot": {
      ship: "Raumfähre der Lambda-Klasse",
      name: "Pilot der Omikron-Gruppe"
    },
    "Lieutenant Lorrir": {
      ship: "TIE-Abfangjäger",
      text: "Wenn du die Aktion Fassrolle ausführst, kannst du 1 Stressmarker erhalten, um die (%BANKLEFT% 1) oder (%BANKRIGHT% 1) Manöverschablone anstatt der (%STRAIGHT% 1) Manöverschablone zu benutzen."
    },
    "Royal Guard Pilot": {
      ship: "TIE-Abfangjäger",
      name: "Pilot der Roten Garde"
    },
    "Tetran Cowall": {
      ship: "TIE-Abfangjäger",
      text: "Immer wenn du ein %UTURN% Manöver aufdeckst, kannst du das Manöver mit einer Geschwindigkeit von \"1,\" \"3,\" oder \"5\" ausführen."
    },
    "Kir Kanos": {
      ship: "TIE-Abfangjäger",
      text: "Wenn du ein Ziel in Reichweite 2-3 angreifst, darfst du einen Ausweichmarker ausgeben, um 1 %HIT% zu deinem Wurf hinzuzufügen."
    },
    "Carnor Jax": {
      ship: "TIE-Abfangjäger",
      text: "Feindliche Schiffe in Reichweite 1 können weder Fokussierung und Ausweichen Aktionen durchführen noch Ausweichmarker und Fokusmarker ausgeben."
    },
    "GR-75 Medium Transport": {
      ship: "Medium-Transporter GR-75",
      name: "Medium-Transporter GR-75"
    },
    "Bandit Squadron Pilot": {
      ship: "Z-95-Kopfjäger",
      name: "Pilot der Bandit-Staffel"
    },
    "Tala Squadron Pilot": {
      ship: "Z-95-Kopfjäger",
      name: "Pilot der Tala-Staffel"
    },
    "Lieutenant Blount": {
      ship: "Z-95-Kopfjäger",
      name: "Lieutenant Blount",
      text: "Wenn du angreifst, triffst du immer, selbst wenn das verteidigende Schiff keinen Schaden nimmt."
    },
    "Airen Cracken": {
      ship: "Z-95-Kopfjäger",
      name: "Airen Cracken",
      text: "Nachdem du angegriffen hast, darfst du ein anderes freundliches Schiff in Reichweite 1 wählen. Dieses Schiff darf 1 freie Aktion durchführen."
    },
    "Delta Squadron Pilot": {
      ship: "TIE-Jagdbomber",
      name: "Pilot der Delta-Staffel"
    },
    "Onyx Squadron Pilot": {
      ship: "TIE-Jagdbomber",
      name: "Pilot der Onyx-Staffel"
    },
    "Colonel Vessery": {
      ship: "TIE-Jagdbomber",
      text: "Wenn du angreifst und der Verteidiger bereits einen roten Zielerfassungsmarker hat, darfst du ihn unmittelbar nach dem Angriffswurf in die Zielerfassung nehmen."
    },
    "Rexler Brath": {
      ship: "TIE-Jagdbomber",
      text: "Nachdem du angegriffen und damit dem Verteidiger mindestens 1 Schadenskarte zugeteilt hast, kannst du einen Fokusmarker ausgeben, um die soeben zugeteilten Schadenskarten aufzudecken."
    },
    "Knave Squadron Pilot": {
      name: "Pilot der Schurken-Staffel"
    },
    "Blackmoon Squadron Pilot": {
      name: "Pilot der Schwarzmond-Staffel"
    },
    "Etahn A'baht": {
      text: "Sobald ein feindliches Schiff in Reichweite 1–3 und innerhalb deines Feuerwinkels verteidigt, darf der Angreifer 1 %HIT% seiner in ein %CRIT% ändern."
    },
    "Corran Horn": {
      text: "Zu Beginn der Endphase kannst du einen Angriff durchführen. Tust du das, darfst du in der nächsten Runde nicht angreifen."
    },
    "Sigma Squadron Pilot": {
      ship: "TIE-Phantom",
      name: "Pilot der Sigma-Staffel"
    },
    "Shadow Squadron Pilot": {
      ship: "TIE-Phantom",
      name: "Pilot der Schatten-Staffel"
    },
    '"Echo"': {
      ship: "TIE-Phantom",
      name: '"Echo"',
      text: "Wenn du dich enttarnst, musst du statt der (%STRAIGHT% 2)-Manöverschablone die (%BANKRIGHT% 2)- oder (%BANKLEFT% 2)-Schablone verwenden."
    },
    '"Whisper"': {
      ship: "TIE-Phantom",
      name: '"Geflüster"',
      text: "Nachdem du mit einem Angriff getroffen hast, darfst du deinem Schiff 1 Fokusmarker geben."
    },
    "CR90 Corvette (Fore)": {
      name: "CR90-Korvette (Bug)",
      ship: "CR90-Korvette (Bug)",
      text: "Wenn du mit deinen Primärwaffen angreifst, kannst du 1 Energie ausgeben, um 1 zusätzlichen Angriffswürfel zu bekommen"
    },
    "CR90 Corvette (Aft)": {
      name: "CR90-Korvette (Heck)",
      ship: "CR90-Korvette (Heck)"
    },
    "Wes Janson": {
      text: "Nachdem du einen Angriff durchgeführt hast, darfst du 1 Fokus-, Ausweich- oder blauen Zielerfassungsmarker vom Verteidiger entfernen."
    },
    "Jek Porkins": {
      text: "Wenn du einen Stressmarker erhältst, darfst du ihn entfernen und 1 Angriffswürfel werfen. Bei %HIT% bekommt dein Schiff 1 verdeckte Schadenskarte."
    },
    '"Hobbie" Klivian': {
      text: "Wenn du ein Schiff in die Zielerfassung nimmst oder einen Zielerfassungsmarker ausgibst, kannst du 1 Stressmarker von deinem Schiff entfernen."
    },
    "Tarn Mison": {
      text: "Wenn ein feindliches Schiff einen Angriff gegen dich ansagt, kannst du dieses Schiff in die Zielerfassung nehmen."
    },
    "Jake Farrell": {
      text: "Nachdem du die Aktion Fokussierung durchgeführt oder einen Fokusmarker erhalten hast, darfst du als freie Aktion einen Schub oder eine Fassrolle durchführen."
    },
    "Gemmer Sojan": {
      name: "Gemmer Sojan",
      text: "Solange du in Reichweite 1 zu mindestens einem feindlichen Schiff bist, steigt dein Wendigkeitswert um 1."
    },
    "Keyan Farlander": {
      text: "Beim Angreifen darfst du 1 Stressmarker entfernen, um alle deine %FOCUS% in %HIT% zu ändern."
    },
    "Nera Dantels": {
      text: "Mit %TORPEDO%-Sekundärwaffen kannst du auch feindliche Schiffe außerhalb deines Feuerwinkels angreifen."
    },
    "Wild Space Fringer": {
      name: "Grenzgänger aus dem Wilden Raum"
    },
    "Dash Rendar": {
      text: "Du darfst in der Aktivierungsphase und beim Durchführen von Aktionen Hindernisse ignorieren."
    },
    '"Leebo"': {
      text: "Immer wenn du eine offene Schadenskarte erhältst, ziehst du 1 weitere Schadenskarte. Wähle 1, die abgehandelt wird, und lege die andere ab."
    },
    "Eaden Vrill": {
      text: "Wirf 1 zusätzlichen Angriffswürfel, wenn du mit den Primärwaffen auf ein Schiff mit Stressmarker schießt."
    },
    "Patrol Leader": {
      name: "Patrouillenführer"
    },
    "Rear Admiral Chiraneau": {
      name: "Konteradmiral Chiraneau",
      text: "Wenn du ein Ziel in Reichweite 1-2 angreifst, kannst du ein %FOCUS% in ein %CRIT% ändern."
    },
    "Commander Kenkirk": {
      text: "Wenn du keine Schilde und mindestens 1 Schadenskarte hast, steigt deine Wendigkeit um 1."
    },
    "Captain Oicunn": {
      text: "Nach dem Ausführen eines Manövers nimmt jedes feindliche Schiff, das du berührst, 1 Schaden."
    },
    "Prince Xizor": {
      ship: "SternenViper",
      name: "Prinz Xizor",
      text: "Sobald du verteidigst, darf ein freundliches Schiff in Reichweite 1 ein nicht-negiertes %HIT% oder %CRIT% an deiner Stelle nehmen."
    },
    "Guri": {
      ship: "SternenViper",
      text: "Wenn du zu Beginn der Kampfphase in Reichweite 1 zu einem feindlichen Schiff bist, darfst du 1 Fokusmarker auf dein Schiff legen."
    },
    "Black Sun Vigo": {
      ship: "SternenViper",
      name: "Vigo der Schwarzen Sonne"
    },
    "Black Sun Enforcer": {
      ship: "SternenViper",
      name: "Vollstrecker der Schwarzen Sonne"
    },
    "Serissu": {
      ship: "M3-A Abfangjäger",
      text: "Sobald ein anderes freundliches Schiff in Reichweite 1 verteidigt, darf es 1 Verteidigungswürfel neu würfeln."
    },
    "Laetin A'shera": {
      ship: "M3-A Abfangjäger",
      text: "Nachdem du gegen einen Angriff verteidigt hast und falls der Angriff nicht getroffen hat, darfst du deinem Schiff 1 Ausweichmarker zuordnen."
    },
    "Tansarii Point Veteran": {
      ship: "M3-A Abfangjäger",
      name: "Veteran von Tansarii Point"
    },
    "Cartel Spacer": {
      ship: "M3-A Abfangjäger",
      name: "Raumfahrer des Kartells"
    },
    "IG-88A": {
      text: "Nachdem du einen Angriff durchgeführt hast, der den Verteidiger zerstört, darfst du 1 Schild wiederaufladen."
    },
    "IG-88B": {
      text: "Ein Mal pro Runde darfst du, nachdem du mit einem Angriff verfehlt hast, einen weiteren Angriff mit einer ausgerüsteten %CANNON%-Sekundärwaffe durchführen."
    },
    "IG-88C": {
      text: "Nachdem du die Aktion Schub durchgeführt hast, darfst du eine freie Aktion Ausweichen durchführen."
    },
    "IG-88D": {
      text: "Du darfst die Manöver (%SLOOPLEFT% 3) oder (%SLOOPRIGHT% 3) auch mit den entsprechenden Schablonen für Wendemanöver (%TURNLEFT% 3) bzw. (%TURNRIGHT% 3) ausführen."
    },
    "Boba Fett (Scum)": {
      name: "Boba Fett (Abschaum)",
      text: "Sobald du angreifst oder verteidigst, darfst du für jedes feindliche Schiff in Reichweite 1 einen deiner Würfel neu würfeln."
    },
    "Kath Scarlet (Scum)": {
      name: "Kath Scarlet (Abschaum)",
      text: "Sobald du ein Schiff innerhalb deines Zusatz-Feuerwinkels angreifst, erhältst du 1 zusätzlichen Angriffswürfel."
    },
    "Emon Azzameen": {
      text: "Sobald du eine Bombe legst, darfst du auch die Schablone [%TURNLEFT% 3], [%STRAIGHT% 3] oder [%TURNRIGHT% 3] anstatt der [%STRAIGHT% 1]-Schablone verwenden."
    },
    "Mandalorian Mercenary": {
      name: "Mandalorianischer Söldner"
    },
    "Kavil": {
      text: "Sobald du ein Schiff außerhalb deines Feuerwinkels angreifst, erhältst du 1 zusätzlichen Angriffswürfel."
    },
    "Drea Renthal": {
      text: "Nachdem du einen Zielerfassungsmarker ausgegeben hast, darfst du 1 Stressmarker nehmen, um ein Schiff in die Zielerfassung zu nehmen."
    },
    "Syndicate Thug": {
      name: "Verbrecher des Syndikats"
    },
    "Hired Gun": {
      name: "Söldner"
    },
    "Dace Bonearm": {
      text: "Sobald ein feindliches Schiff in Reichweite 1-3 mindestens 1 Ionenmarker erhält und falls du keinen Stressmarker hast, darfst du 1 Stressmarker nehmen, damit das Schiff 1 Schaden nimmt."
    },
    "Palob Godalhi": {
      text: "Zu Beginn der Kampfphase darfst du 1 Fokus- oder Ausweichmarker von einem feindlichen Schiff in Reichweite 1-2 entfernen und dir selbst zuordnen."
    },
    "Torkil Mux": {
      text: "Wähle am Ende der Aktivierungsphase 1 feindliches Schiff in Reichweite 1-2. Bis zum Ende der Kampfphase wird der Pilotenwert des Schiffs als \"0\" behandelt."
    },
    "Spice Runner": {
      name: "Spiceschmuggler"
    },
    "N'Dru Suhlak": {
      ship: "Z-95-Kopfjäger",
      text: "Sobald du angreifst, erhältst du 1 zusätzlichen Angriffswürfel, falls keine anderen freundlichen Schiffe in Reichweite 1-2 zu dir sind."
    },
    "Kaa'To Leeachos": {
      ship: "Z-95-Kopfjäger",
      text: "Zu Beginn der Kampfphase darfst du 1 Fokus- oder Ausweichmarker von einem anderem freundlichen Schiff in Reichweite 1-2 entfernen und dir selbst zuordnen."
    },
    "Binayre Pirate": {
      ship: "Z-95-Kopfjäger",
      name: "Binayre-Pirat"
    },
    "Black Sun Soldier": {
      ship: "Z-95-Kopfjäger",
      name: "Kampfpilot der Schwarzen Sonne"
    },
    "Commander Alozen": {
      text: "Zu Beginn der Kampfphase darfst du ein feindliches Schiff in Reichweite 1 in die Zielerfassung nehmen."
    },
    "Raider-class Corvette (Fore)": {
      ship: "Korv. der Sturm-Klasse (Bug)",
      name: "Korv. der Sturm-Klasse (Bug)",
      text: "Ein Mal pro Runde darfst du, nachdem du einen Primärwaffen-Angriff durchgeführt hast, 2 Energie ausgeben, um einen weiteren Primärwaffen-Angriff durchzuführen."
    },
    "Raider-class Corvette (Aft)": {
      ship: "Korv. der Sturm-Klasse (Heck)",
      name: "Korv. der Sturm-Klasse (Heck)"
    },
    "Bossk": {
      text: "Sobald du einen Angriff durchführst und triffst, kannst du , bevor du Schaden verursachst, 1 deiner %CRIT% negieren, um 2 %HIT% hinzuzufügen."
    },
    "Talonbane Cobra": {
      ship: "Kihraxz-Jäger",
      text: "Sobald du angreifst oder verteidigst, wird der Effekt deiner Kampfvorteile durch Reichweite verdoppelt."
    },
    "Miranda Doni": {
      text: "Ein Mal pro Runde darfst du, sobald du angreifst, entweder 1 Schild ausgeben, um 1 zusätzlichen Angriffswürfel zu werfen, <strong>oder</strong> 1 Angriffswürfel weniger werfen, um 1 Schild wiederaufzuladen."
    },
    '"Redline"': {
      name: '"Rote Linie"',
      ship: "TIE-Vergelter",
      text: "Du darfst 2 Zielerfassungen auf demselben Schiff haben. Sobald du ein Schiff in die Zielerfassung nimmst, darfst du es ein zweites Mal in die Zielerfassung nehmen."
    },
    '"Deathrain"': {
      name: '"Todesregen"',
      ship: "TIE-Vergelter",
      text: "Sobald du eine Bombe legst, darfst du die Stopper am Bug deines Schiffs benutzen. Nachdem du eine Bombe gelegt hast, darfst du als freie Aktion eine Fassrolle durchführen."
    },
    "Juno Eclipse": {
      text: "Sobald du dein Manöver aufdeckst, darfst du die Geschwindigkeit um 1 erhöhen oder reduzieren (bis zu einem Minimum von 1)."
    },
    "Zertik Strom": {
      text: "Sobald feindliche Schiffe in Reichweite 1 angreifen, können sie ihren Kampfvorteil durch Reichweite nicht hinzufügen."
    },
    "Lieutenant Colzet": {
      text: "Zu Beginn der Endphase darfst du einen Zielerfassungsmarker , den du auf einem feindlichen Schiff liegen hast, ausgeben, um 1 seiner verdeckten Schadenskarten (zufällig bestimmt) aufzudecken."
    },
    "Latts Razzi": {
      text: "Sobald ein freundliches Schiff einen Angriff deklariert und du den Verteidiger in der Zielerfassung hast, kannst du einen Zielerfassungsmarker ausgeben, um die Wendigkeit des Verteidigers für diesen Angriff um 1 zu senken."
    },
    "Graz the Hunter": {
      ship: "Kihraxz-Jäger",
      name: "Graz der Jäger",
      text: "Wirf 1 zusätzlichen Verteidigungswürfel, wenn der Angreifer in deinem Feuerwinkel ist, sobald du verteidigst."
    },
    "Esege Tuketu": {
      text: "Sobald ein anderes freundliches Schiff in Reichweite 1-2 angreift, darf es deine Fokusmarker wie seine eigenen behandeln."
    },
    "Moralo Eval": {
      text: "Du darfst Angriffe mit %CANNON%-Sekundärwaffen gegen Schiffe in deinem Zusatz-Feuerwinkel durchführen."
    },
    "Warden Squadron Pilot": {
      ship: "K-Wing",
      name: "Pilot der Beschützer-Staffel"
    },
    "Guardian Squadron Pilot": {
      ship: "K-Wing",
      name: "Pilot der Wächter-Staffel"
    },
    "Cutlass Squadron Pilot": {
      ship: "TIE-Vergelter",
      name: "Pilot der Entermesser-Staffel"
    },
    "Black Eight Squadron Pilot": {
      ship: "TIE-Vergelter",
      name: "Pilot der Schwarzen-Acht-Staffel"
    },
    "Cartel Marauder": {
      ship: "Kihraxz-Jäger",
      name: "Kartell-Marodeur"
    },
    "Black Sun Ace": {
      ship: "Kihraxz-Jäger",
      name: "Fliegerass der schwarzen Sonne"
    },
    "Trandoshan Slaver": {
      ship: "YV-666",
      name: "Trandoshanischer Sklavenjäger"
    },
    'Gozanti-class Cruiser': {
      ship: "Kreuzer der Gozanti-Klasse",
      name: "Kreuzer der Gozanti-Klasse",
      text: "Nachdem du ein Manöver ausgeführt hast, darfst du 2 angedockte Schiffe absetzen."
    },
    '"Scourge"': {
      ship: "TIE-Jäger",
      name: "Geissel",
      text: "Sobald du einen Verteidiger angreifst, der 1 oder mehr Schadenskarten hat, wirf 1 zusätzlichen Angriffswürfel."
    },
    "The Inquisitor": {
      text: "When attacking with your primary weapon at Range 2-3, treat the range of the attack as Range 1."
    },
    "Zuckuss": {
      text: "When attacking, you may roll 1 additional attack die.  If you do, the defender rolls 1 additional defense die."
    },
    "Dengar": {
      text: "Once per round after defending, if the attacker is inside your firing arc, you may perform an attack against the that ship."
    },
    "Poe Dameron": {
      ship: "T-70-X-Flügler",
      text: "Solange du angreifst oder verteidigst, und wenn du einen Fokusmarker hast, darfst du 1 deiner %FOCUS% in %HIT% oder %EVADE% ändern."
    },
    '"Blue Ace"': {
      ship: "T-70-X-Flügler",
      name: '"Ass Blau"',
      text: "Soabld du eine Schub-Aktion ausführst, darfst du das Manöver (%TURNLEFT% 1) oder (%TURNRIGHT% 1) verwenden."
    },
    '"Red Ace"': {
      ship: "T-70-X-Flügler",
      name: '"Ass Rot"',
      text: 'Das erste Mal wenn du in jeder Runde ein Schild von deinem Schiff entfernst, weise deinem Schiff 1 Ausweichmarker zu.'
    },
    "Blue Squadron Novice": {
      ship: "T-70-X-Flügler",
      name: "Anfängerpilot der Blauen Staffel"
    },
    "Red Squadron Veteran": {
      ship: "T-70-X-Flügler",
      name: "Veteran der Roten Staffel"
    },
    '"Omega Ace"': {
      ship: "TIE/EO-Jäger",
      name: '"Ass Omega"',
      text: "Sobald du angreifst, kannst du einen Fokusmarker und eine deiner Zielerfassungen auf dem Verteidiger ausgeben, um alle deine Würfelergebnisse in %KRIT% zu ändern."
    },
    '"Epsilon Leader"': {
      ship: "TIE/EO-Jäger",
      name: "Epsilon Eins",
      text: "Zu Beginn der Kampfphase entferne je 1 Stressmarker von jedem freundlichen Schiff in Reichweite 1."
    },
    '"Zeta Ace"': {
      ship: "TIE/EO-Jäger",
      name: "Ass Zeta",
      text: "Sobald du eine Fassrolle ausführst, darfst du die (%STRAIGHT% 2) Manöverschablone verwenden anstatt der (%STRAIGHT% 1) Manöverschablone."
    },
    "Omega Squadron Pilot": {
      ship: "TIE/EO-Jäger",
      name: "Pilot der Omega-Staffel"
    },
    "Zeta Squadron Pilot": {
      ship: "TIE/EO-Jäger",
      name: "Pilot der Zeta-Staffel"
    },
    "Epsilon Squadron Pilot": {
      ship: "TIE/EO-Jäger",
      name: "Pilot der Epsilon-Staffel"
    },
    '"Omega Leader"': {
      ship: "TIE/EO-Jäger",
      name: '"Omega Eins"',
      text: 'Feindliche Schiffe, die du in der Zielerfassung hast, können keine Würfel modifizieren, sobald sie dich angreifen oder sich gegen dich verteidigen.'
    },
    'Hera Syndulla': {
      text: 'When you reveal a green or red maneuver, you may rotate your dial to another maneuver of the same difficulty.'
    },
    '"Youngster"': {
      ship: "TIE-Jäger",
      text: "Freundliche TIE-Jäger in Reichweite 1-3 dürfen die Aktion einer von dir ausgerüsteten %ELITE%-Aufwertung durchführen."
    },
    '"Wampa"': {
      ship: "TIE-Jäger",
      text: "Sobald du angreifst, darfst du alle Würfelergebnisse negieren. Negierst du ein %CRIT%, teile dem Verteidiger 1 verdeckte Schadenskarte zu."
    },
    '"Chaser"': {
      ship: "TIE-Jäger",
      text: "Sobald ein anderes freundliches Schiff in Reichweite 1 einen Fokusmarker ausgibt, wird deinem Schiff ein Fokusmarker zugeteilt."
    },
    'Ezra Bridger': {
      text: "When defending, if you are stressed, you may change up to 2 of your %FOCUS% results to %EVADE% results."
    },
    '"Zeta Leader"': {
      ship: "TIE/EO-Jäger",
      name: '"Zeta Eins"',
      text: 'Sobald du angreifst und falls du nicht gestresst bist, darfst du 1 Stressmarker erhalten, um 1 zusätzlichen Würfel zu werfen.'
    },
    '"Epsilon Ace"': {
      ship: "TIE/EO-Jäger",
      name: '"Ass Epsilon"',
      text: 'Solange du keine Schadenskarten hast, behandle deinen Pilotenwert als "12".'
    },
    "Kanan Jarrus": {
      text: "When an enemy ship at Range 1-2 is attacking, you may spend a focus token.  If you do, the attacker rolls 1 fewer attack die."
    },
    '"Chopper"': {
      text: "At the start of the Combat phase, each enemy ship you are touching receives 1 stress token."
    },
    'Hera Syndulla (Attack Shuttle)': {
      text: "When you reveal a green or red maneuver, you may rotate your dial to another maneuver of the same difficulty."
    },
    'Sabine Wren': {
      text: "Immediately before you reveal your maneuver, you may perform a free boost or barrel roll action."
    },
    '"Zeb" Orrelios': {
      text: 'When defending, you may cancel %CRIT% results before %HIT% results.'
    },
    'Tomax Bren': {
      ship: "TIE-Bomber",
      text: 'Once per round, after you discard an %ELITE% Upgrade card, flip that card faceup.'
    },
    'Ello Asty': {
      text: 'While you are not stressed, you may treat your %TROLLLEFT% and %TROLLRIGHT% maneuvers as white maneuvers.',
      ship: "T-70-X-Flügler"
    },
    "Valen Rudor": {
      text: "After defending, you may perform a free action."
    },
    "4-LOM": {
      text: "At the start of the End phase, you may assign 1 of your stress tokens to another ship at Range 1."
    },
    "Tel Trevura": {
      text: "The first time you would be destroyed, instead cancel any remaining damage, discard all Damage cards, and deal 4 facedown Damage cards to this ship."
    },
    "Manaroo": {
      text: "At the start of the Combat phase, you may assign all focus, evade, and target lock tokens assigned to you to another friendly ship."
    }
  };
  upgrade_translations = {
    "Ion Cannon Turret": {
      name: "Ionengeschütz",
      text: "<strong>Angriff:</strong> Greife 1 Schiff an (es muss nicht in deinem Feuerwinkel sein).<br /><br />Wenn der Angriff trifft, nimmt das verteidigende Schiff 1 Schaden und erhält 1 Ionenmarker. Dann werden alle übrigen Würfelergebnisse negiert."
    },
    "Proton Torpedoes": {
      name: "Protonen-Torpedos",
      text: "<strong>Angriff (Zielerfassung):</strong>Gib deine Zielerfassung aus und lege diese Karte ab, um diesen Angriff durchzuführen.<br /><br />Du darfst eines deiner %FOCUS% in ein %CRIT% ändern."
    },
    "R2 Astromech": {
      name: "R2 Astromechdroide",
      text: "Du darfst alle Manöver mit Geschwindigkeit 1 und 2 wie grüne Manöver behandeln."
    },
    "R2-D2": {
      text: "Nachdem du ein grünes Manöver ausgeführt hast, darfst du 1 Schild wiederaufladen (bis maximal zum Schildwert)."
    },
    "R2-F2": {
      text: "<strong>Aktion:</strong> Erhöhe deinen Wendigkeitswert bis zum Ende der Spielrunde um 1."
    },
    "R5-D8": {
      text: "<strong>Aktion:</strong> Wirf 1 Verteidigungswürfel.<br /><br />Lege bei %EVADE% oder %FOCUS% 1 deiner verdeckten Schadenskarten ab."
    },
    "R5-K6": {
      text: "Wirf 1 Verteidigungswürfel nachdem du deine Zielerfassungsmarker ausgegeben hast.<br /><br />Bei %EVADE% nimmst du dasselbe Schiff sofort wieder in die Zielerfassung. Für diesen Angriff kannst du die Zielerfassungsmarker nicht erneut ausgeben."
    },
    "R5 Astromech": {
      name: "R5 Astromechdroide",
      text: "Wähle während der Endphase 1 deiner offnen Schadenskarte mit dem Attribut <strong>Schiff</strong> und drehe sie um."
    },
    "Determination": {
      name: "Entschlossenheit",
      text: "Wenn du eine offene Schadenskarte mit dem Attribut <b>Pilot</b> erhältst, wird diese sofort abgelegt (ohne dass der Kartentext in Kraft tritt)."
    },
    "Swarm Tactics": {
      name: "Schwarmtaktik",
      text: "Du darfst zu Beginn der Kampfphase 1 freundliches Schiff in Reichweite 1 wählen.<br /><br />Bis zum Ende dieser Phase wird das gewählte Schiff so behandelt, als hätte es denselben Pilotenwert wie du."
    },
    "Squad Leader": {
      name: "Staffelführer",
      text: "<strong>Aktion:</strong> Wähle ein Schiff in Reichweite 1-2 mit einem geringeren Pilotenwert als du.<br /><br />Das gewählte Schiff darf sofort 1 freie Aktion durhführen."
    },
    "Expert Handling": {
      name: "Flugkunst",
      text: "<strong>Aktion:</strong> Führe als freie Aktion eine Fassrolle durch. Wenn du kein %BARRELROLL%-Symbol hast, erhältst du 1 Stressmarker.<br /><br />Dann darfst du 1 feindlichen Zielerfassungsmarker von deinem Schiff entfernen."
    },
    "Marksmanship": {
      name: "Treffsicherheit",
      text: "<strong>Aktion:</strong> Wenn du in dieser Runde angreifst, darfst du eines deiner %FOCUS% in ein %CRIT% und alle anderen %FOCUS% in %HIT% ändern."
    },
    "Concussion Missiles": {
      name: "Erschütterungsraketen",
      text: "<strong>Angriff (Zielerfassung):</strong> Gib eine Zielerfassung aus und lege diese Karte ab, um mit dieser Sekundärwaffe anzugreifen.<br /><br />Du darfst eine deiner Leerseiten in ein %HIT% ändern."
    },
    "Cluster Missiles": {
      name: "Cluster-Raketen",
      text: "<strong>Angriff (Zielerfassung):</strong> Gib eine Zielerfassung aus und lege diese Karte ab, um mit dieser Sekundärwaffe <strong>zwei Mal</strong> anzugreifen"
    },
    "Daredevil": {
      name: "Draufgänger",
      text: "<strong>Aktion:</strong> Führe ein weißes (%TURNLEFT% 1) oder (%TURNRIGHT% 1) Manöver aus. Dann erhältst du einen Stressmarker.<br /><br />Wenn du kein %BOOST%-Aktionssymbol hast, musst du dann 2 Angriffswürfel werfen. Du nimmst allen gewürfelten Schaden (%HIT%) und kritischen Schaden (%CRIT%)."
    },
    "Elusiveness": {
      name: "Schwer zu Treffen",
      text: "Wenn du verteidigst, darfst du 1 Stressmarker nehmen, um 1 Angriffswürfel zu wählen. Diesen muss der Angreifer neu würfeln.<br /><br />Du kannst diese Fähigkeit nicht einsetzen, solange du 1 oder mehrere Stressmarker hast."
    },
    "Homing Missiles": {
      name: "Lenkraketen",
      text: "<strong>Angriff (Zielerfassung):</strong> Lege diese Karte ab, um diesen Angriff durchzuführen.<br /><br />Bei diesem Angriff kann der Verteidiger keine Ausweichmarker ausgeben."
    },
    "Push the Limit": {
      name: "Bis an die Grenzen",
      text: "Einmal pro Runde darfst du nach dem Durchführen einer Aktion eine freie Aktion aus deiner Aktionsleiste durchführen.<br /><br />Dann erhältst du 1 Stressmarker."
    },
    "Deadeye": {
      name: "Meisterschütze",
      text: "Du darfst die Bedingung \"Angriff (Zielerfassung):\" in \"Angriff (Fokussierung):\" ändern.<br /><br />Wenn ein Angriff das Ausgeben von Zielerfassungsmarkern erfordert, darfst du stattdessen auch einen Fokusmarker ausgeben."
    },
    "Expose": {
      name: "Aggressiv",
      text: "<strong>Aktion:</strong> Bis zum Ende der Runde steigt dein Primärwaffenwert um 1, dafür sinkt dein Wendigkeitswert um 1."
    },
    "Gunner": {
      name: "Bordschütze",
      text: "Unmittelbar nachdem du mit einem Angriff verfehlt hast, darfst du einen weiteren Angriff mit deiner Primärwaffe durchführen. Danach kannst du in dieser Runde nicht noch einmal angreifen."
    },
    "Ion Cannon": {
      name: "Ionenkanonen",
      text: "<strong>Angriff:</strong> Greife 1 Schiff mit dieser Sekundärwaffe an.<br /><br />Wenn du triffst, nimmt das verteidigende Schiff 1 Schaden und erhält 1 Ionenmarker. Dann werden <b>alle</b> übrigen Würfelergebnisse negiert."
    },
    "Heavy Laser Cannon": {
      name: "Schwere Laserkanone",
      text: "<strong>Attack:</strong> Greife 1 Schiff mit dieser Sekundärwaffe an.<br /><br />Unmittelbar nach dem Angriffswurf musst du alle %CRIT% in %HIT% ändern."
    },
    "Seismic Charges": {
      name: "Seismische Bomben",
      text: "Nach dem Aufdecken deines Manöverrads darfst du diese Karte ablegen um 1 Seismischen Bomben-Marker zu <strong>legen</strong>.<br /><br />Der Marker <strong>detoniert</strong> am Ende der Aktivierungsphase."
    },
    "Mercenary Copilot": {
      name: "Angeheuerter Kopilot",
      text: "Wenn du ein Ziel in Reichweite 3 angreifst, darfst du eines deiner %HIT%  in ein %CRIT% ändern."
    },
    "Assault Missiles": {
      name: "Angriffsraketen",
      text: "Angriff (Zielerfassung): Gib eine Zielerfassung aus und lege diese Karte ab, um mit dieser Sekundärwaffe anzugreifen.<br /><br />Wenn du triffst, nimmt jedes andere Schiff in Reichweite 1 des verteidigendes Schiffs 1 Schaden."
    },
    "Veteran Instincts": {
      name: "Veteraneninstinkte",
      text: "Dein Pilotenwert steigt um 2."
    },
    "Proximity Mines": {
      name: "Annährungsminen",
      text: "<strong>Aktion:</strong> Lege diese Karte ab, um 1 Annährungsminen-Marker zu <strong>legen</strong>.<br /><br />Der Marker <strong>detoniert</strong>, sobald sich die Basis eines Schiffs oder die Manöverschablone mit dem Marker überschneidet."
    },
    "Weapons Engineer": {
      name: "Waffen-Techniker",
      text: "Du darfst 2 verschiedene Schiffe gleichzeitig in der Zielerfassung haben (maximal 1 Zielerfassung pro feindlichem Schiff).<br /><br />Sobald du eine Zielerfassung durchführst, darfst du zwei verschiedene Schiffe als Ziele erfassen."
    },
    "Draw Their Fire": {
      name: "Das Feuer auf mich ziehen",
      text: "Wenn ein freundliches Schiff in Reichweite 1 durch einen Angriff getroffen wird, darfst du anstelle dieses Schiffs den Schaden für 1 nicht-negiertes %CRIT% auf dich nehmen."
    },
    "Luke Skywalker": {
      text: "%DE_REBELONLY%%LINEBREAK%Unmittelbar nachdem du mit einem Angriff verfehlt hast, darfst du einen weiteren Angriff mit deiner Primärwaffe durchführen. Du darfst ein %FOCUS% in ein %HIT% ändern. Danach kannst du in dieser Runde nicht noch einmal angreifen."
    },
    "Nien Nunb": {
      text: "%DE_REBELONLY%%LINEBREAK%Du darfst alle %STRAIGHT%-Manöver wie grüne Manöver behandeln."
    },
    "Chewbacca": {
      name: "Chewbacca (Crew)",
      text: "%DE_REBELONLY%%LINEBREAK%Wenn du eine Schadenskarte erhältst, darfst du sie sofort ablegen und 1 Schild wiederaufladen.<br /><br />Danach wird diese Aufwertungskarte abgelegt."
    },
    "Advanced Proton Torpedoes": {
      name: "Verstärkte Protonen-Torpedos",
      text: "<strong>Angriff (Zielerfassung):</strong> Gib eine Zielerfassung aus und lege diese Karte ab um mit dieser Sekundärwaffe anzugreifen.<br /><br />Du darfst bis zu 3 deiner Leerseiten in %FOCUS% ändern."
    },
    "Autoblaster": {
      name: "Repetierblaster",
      text: "<strong>Angriff:</strong> Greife 1 Schiff mit dieser Sekundärwaffe an.<br /><br />Deine %HIT% können von Verteidigungswürfeln nicht negiert werden.<br /><br />Der Verteidiger darf %CRIT% negieren, bevor alle %HIT% negiert wurden."
    },
    "Fire-Control System": {
      name: "Feuerkontrollsystem",
      text: "Nachdem du angegriffen hast, darfst du eine Zielerfassung auf den Verteidiger durchführen."
    },
    "Blaster Turret": {
      name: "Blastergeschütz",
      text: "<strong>Angriff (Fokussierung):</strong> Gib 1 Fokusmarker aus, um 1 Schiff mit dieser Sekundärwaffe anzugreifen (es muss nicht in deinem Feuerwinkel sein)."
    },
    "Recon Specialist": {
      name: "Aufklärungs-Experte",
      text: "Wenn du die Aktion Fokussieren durchführst, lege 1 zusätzlichen Fokusmarker neben dein Schiff."
    },
    "Saboteur": {
      text: "<strong>Aktion:</strong> Wähle 1 feindliches Schiff in Reichweite 1 und wirf 1 Angriffswürfel. Bei %HIT% oder %CRIT%, wähle 1 zufällige verdeckte Schadenskarte des Schiffs, decke sie auf und handle sie ab."
    },
    "Intelligence Agent": {
      name: "Geheimagent",
      text: "Wähle zu Beginn der Aktivierungsphase 1 feindliches Schiff in Reichweite 1-2. Du darfst dir das ausgewählte Manöver dieses Schiffs ansehen."
    },
    "Proton Bombs": {
      name: "Protonenbomben",
      text: "Nach dem Aufdecken deines Manöverrads darfst du diese Karte ablegen um 1 Protonenbomben-Marker zu <strong>legen</strong>.<br /><br />Der Marker <strong>detoniert</strong> am Ende der Aktivierungsphase."
    },
    "Adrenaline Rush": {
      name: "Adrenalinschub",
      text: "Wenn du ein rotes Manöver aufdeckst, darfst du diese Karte ablegen, um das Manöver bis zum Ende der Aktivierungsphase wie ein weißes Manöver zu behandeln."
    },
    "Advanced Sensors": {
      name: "Verbesserte Sensoren",
      text: "Unmittelbar vor dem Aufdecken deines Manövers darfst du 1 freie Aktion durchführen.<br /><br />Wenn du diese Fähigkeit nutzt, musst du den Schritt \"Aktion durchführen\" in dieser Runde überspringen."
    },
    "Sensor Jammer": {
      name: "Störsender",
      text: "Beim Verteidigen darfst du eines der %HIT% des Angreifers in ein %FOCUS% ändern.<br /><br />Der Angreifer darf den veränderten Würfel nicht neu würfeln."
    },
    "Darth Vader": {
      name: "Darth Vader (Crew)",
      text: "%DE_IMPERIALONLY%%LINEBREAK%Nachdem du ein feindliches Schiff angegriffen hast, darfst du 2 Schaden nehmen, damit dieses Schiff 1 kritischen Schaden nimmt."
    },
    "Rebel Captive": {
      name: "Gefangener Rebell",
      text: "%DE_IMPERIALONLY%%LINEBREAK%Ein Mal pro Runde erhält das erste Schiff, das einen Angriff gegen dich ansagt, sofort 1 Stressmarker."
    },
    "Flight Instructor": {
      name: "Fluglehrer",
      text: "Beim Verteidigen darfst du 1 deiner %FOCUS% neu würfeln. Hat der Angreifer einen Pilotenwert von 2 oder weniger, darfst du stattdessen 1 deiner Leerseiten neu würfeln."
    },
    "Navigator": {
      name: "Navigator",
      text: "Nach dem Aufdecken deines Manöverrads darfst du das Rad auf ein anderes Manöver mit gleicher Flugrichtung drehen.<br /><br />Wenn du bereits Stressmarker hast, darfst du es nicht auf ein rotes Manöver drehen."
    },
    "Opportunist": {
      name: "Opportunist",
      text: "Wenn du angreifst und der Verteidiger keine Fokusmarker oder Ausweichmarker hat, kannst du einen Stressmarker nehmen, um einen zusätzlichen Angriffswürfel zu erhalten.<br /><br />Du kannst diese Fähigkeit nicht nutzen, wenn du einen Stressmarker hast."
    },
    "Comms Booster": {
      name: "Kommunikationsverstärker",
      text: "<strong>Energie:</strong> Gib 1 Energie aus, um sämtliche Stressmarker von einem freundlichen Schiff in Reichweite 1-3 zu entfernen. Dann erhält jenes Schiff 1 Fokusmarker."
    },
    "Slicer Tools": {
      name: "Hackersoftware",
      text: "<strong>Aktion:</strong> Wähle 1 oder mehrere feindliche Schiffe mit Stressmarker in Reichweite 1-3. Bei jedem gewählten Schiff kannst du 1 Energie ausgeben, damit es 1 Schaden nimmt."
    },
    "Shield Projector": {
      name: "Schildprojektor",
      text: "Wenn ein feindliches Schiff in der Kampfphase an die Reihe kommt, kannst du 3 Energie ausgeben, um das Schiff bis zum Ende der Phase dazu zu zwingen dich anzugreifen, falls möglich."
    },
    "Ion Pulse Missiles": {
      name: "Ionenpuls-Raketen",
      text: "<strong>Angriff (Zielerfassung):</strong> Lege diese Karte ab, um mit dieser Sekundärwaffe anzugreifen.<br /><br />Wenn du triffst, nimmt das verteidigende Schiff 1 Schaden und erhält 2 Ionenmarker. Dann werden <strong>alle<strong> übrigen Würfelergebnisse negiert."
    },
    "Wingman": {
      name: "Flügelmann",
      text: "Entferne zu Beginn der Kampfphase 1 Stressmarker von einem anderen freundlichen Schiff in Reichweite 1."
    },
    "Decoy": {
      name: "Täuschziel",
      text: "Zu Beginn der Kampfphase darfst du 1 freundliches Schiff in Reichweite 1-2 wählen. Bis zum Ende der Phase tauscht du mit diesem Schiff den Pilotenwert."
    },
    "Outmaneuver": {
      name: "Ausmanövrieren",
      text: "Wenn du ein Schiff innerhalb deines Feuerwinkels angreifst und selbst nicht im Feuerwinkel dieses Schiffs bist, wird seine Wendigkeit um 1 reduziert (Minimum 0)"
    },
    "Predator": {
      name: "Jagdinstinkt",
      text: "Wenn du angreifst, darfst du 1 Angriffswürfel neu würfeln. Ist der Pilotenwert des Verteidigers2 oder niedriger, darfst du stattdessen bis zu 2 Angriffswürfel neu würfeln."
    },
    "Flechette Torpedoes": {
      name: "Flechet-Torpedos",
      text: "<strong>Angriff (Zielerfassung):</strong> Gib deine Zielerfassungsmarker aus und lege diese Karte ab, um mit dieser Sekundärwaffe anzugreifen.<br /><br />Nachdem du angegriffen hast, bekommt der Verteidiger 1 Stressmarker, sofern sein Hüllenwert 4 oder weniger beträgt."
    },
    "R7 Astromech": {
      name: "R7-Astromech-Droide",
      text: "Ein Mal pro Runde kannst du beim Verteidigen gegen den Angriff eines Schiffs, das du in Zielerfassung hast, die Zielerfassungsmarker ausgeben, um beliebige (oder alle) Angriffswürfel zu wählen. Diese muss der Angreifer neu würfeln."
    },
    "R7-T1": {
      name: "R7-T1",
      text: "<strong>Aktion:</strong> Wähle ein feindliches Schiff in Reichweite 1-2. Wenn du im Feuerwinkel dieses Schiffs bist, kannst du es in die Zielerfassung nehmen. Dann darfst du als freie Aktion einen Schub durchführen."
    },
    "Tactician": {
      name: "Taktiker",
      text: "Nachdem du ein Schiff in Reichweite 2 und innerhalb deines Feuerwinkels angegriffen hast, erhält es 1 Stressmarker."
    },
    "R2-D2 (Crew)": {
      name: "R2-D2 (Crew)",
      text: "%DE_REBELONLY%%LINEBREAK%Wenn du am Ende der Endphase keine Schilde hast, darfst du 1 Schild wieder aufladen und 1 Angriffswürfel werfen. Bei %HIT% musst du 1 deiner verdeckten Schadenskarten (zufällig gewählt) umdrehen und abhandeln."
    },
    "C-3PO": {
      name: "C-3PO",
      text: "%DE_REBELONLY%%LINEBREAK%Einmal pro Runde darfst du, bevor du 1 oder mehrere Verteidigungswürfel wirfst, laut raten, wie viele %EVADE% du würfeln wirst. Wenn du richtig geraten hast (bevor die Ergebnisse modifiziert werden), wird 1 %EVADE% hinzugefügt."
    },
    "Single Turbolasers": {
      name: "Einzelne Turbolasers",
      text: "<strong>Angriff (Energie):</strong> gib 2 Energie von dieser Karte aus, um mit dieser Sekundärwaffe anzugreifen. Der Verteidiger verwendet zum Verteidigen seinen doppelten Wendigkeitswert. Du darfst 1 deiner %FOCUS% in ein %HIT% ändern."
    },
    "Quad Laser Cannons": {
      name: "Vierlings-Laserkanone",
      text: "<strong>Angriff (Energie):</strong> Gib 1 Energie von dieser Karte aus, um mit dieser Sekundärwaffe anzugreifen. Wenn der Angriff verfehlt, kannst du sofort 1 Energie von dieser Karte ausgeben, um den Angriff zu wiederholen."
    },
    "Tibanna Gas Supplies": {
      name: "Tibanna-Gas-Vorräte",
      text: "<strong>Energie:</strong> Du kannst diese Karte ablegen, um 3 Energie zu erzeugen."
    },
    "Ionization Reactor": {
      name: "Ionenreaktor",
      text: "<strong>Energie:</strong> Gib 5 Energie von dieser Karte aus und lege sie ab, damit jedes andere Schiff in Reichweite 1 einen Schaden nimmt und einen Ionenmarker bekommt."
    },
    "Engine Booster": {
      name: "Nachbrenner",
      text: "Unmittelbar bevor du dein Manöverrad aufdeckst, kannst du 1 Energie ausgeben, um ein weißes (%STRAIGHT% 1)-Manöver auszuführen. Wenn es dadurch zur Überschneidung mit einem anderen Schiff käme, darfst du diese Fähigkeit nicht nutzen."
    },
    "R3-A2": {
      name: "R3-A2",
      text: "Nachdem du das Ziel deines Angriffs angesagt hast, darfst du, wenn der Verteidiger in deinem Feuerwinkel ist, 1 Stressmarker nehmen, damit der Verteidiger auch 1 Stressmarker bekommt."
    },
    "R2-D6": {
      name: "R2-D6",
      text: "Deine Aufwertungsleiste bekommt ein %ELITE%-Symbol.<br /><br />Du kannst diese Aufwertung nicht ausrüsten, wenn du bereits ein %ELITE%-Symbol hast oder dein Pilotenwert 2 oder weniger beträgt."
    },
    "Enhanced Scopes": {
      name: "Verbessertes Radar",
      text: "Behandle in der Aktivierungsphase deinen Pilotenwert als \"0\"."
    },
    "Chardaan Refit": {
      name: "Chardaan-Nachrüstung",
      text: "<span class=\"card-restriction\">Nur für A-Wing</span>%LINEBREAK%Diese Karte hat negative Kommandopunktekosten."
    },
    "Proton Rockets": {
      name: "Protonenraketen",
      text: "<strong>Angriff (Fokussierung):</strong> Lege diese Karte ab, um mit dieser Sekundärwaffe anzugreifen.<br /><br />Du darfst so viele zusätzliche Angriffswürfel werfen, wie du Wendigkeit hast (maximal 3 zusätzliche Würfel)."
    },
    "Kyle Katarn": {
      name: "Kyle Katarn (Crew)",
      text: "%DE_REBELONLY%%LINEBREAK%Nachdem du einen Stressmarker von deinem Schiff entfernt hast, darfst du deinem Schiff einen Fokusmarker geben."
    },
    "Jan Ors": {
      name: "Jan Ors (Crew)",
      text: "%DE_REBELONLY%%LINEBREAK%Sobald ein freundliches Schiff in Reichweite 1-3 eine Aktion Fokussierung durchführt oder ihm ein Fokusmarker zugeordnet werden würde, darfst du diesem Schiff stattdessen ein Mal pro Runde einen Ausweichmarker zuordnen."
    },
    "Toryn Farr": {
      text: "%DE_HUGESHIPONLY%%LINEBREAK%%DE_REBELONLY%%LINEBREAK%<strong>Aktion:</strong> Gib X Energie aus, um X feindliche Schiffe in Reichweite 1-2 zu wählen. Sämtliche Fokus-, Ausweich- und blauen Zielerfassungsmarker dieser Schiffe werden entfernt."
    },
    "R4-D6": {
      text: "Wenn du von einem Angriff getroffen wirst und es mindestens 3 nicht negierte %HIT% gibt, darfst du so viele %HIT% wählen und negieren, bis es nur noch 2 sind. Für jedes auf diese Weise negierte %HIT% bekommst du 1 Stressmarker."
    },
    "R5-P9": {
      text: "Am Ende der Kampfphase kannst du 1 deiner Fokusmarker ausgeben, um 1 Schild wiederaufzuladen (bis maximal zum Schildwert)."
    },
    "WED-15 Repair Droid": {
      name: "WED-15 Reparaturdroide",
      text: "%DE_HUGESHIPONLY%%LINEBREAK%<strong>Aktion:</strong> gib 1 Energie aus, um 1 deiner verdeckten Schadenskarten abzulegen oder gib 3 Energie aus, um 1 deiner offenen Schadenskarten abzulegen."
    },
    "Carlist Rieekan": {
      text: "%DE_HUGESHIPONLY%%LINEBREAK%%DE_REBELONLY%%LINEBREAK%Zu Beginn der Aktivierungsphase kannst du diese Karte ablegen, damit bis zum Ende der Phase der Pilotenwert aller freundlichen Schiffe 12 beträgt."
    },
    "Jan Dodonna": {
      text: "%DE_HUGESHIPONLY%%LINEBREAK%%DE_REBELONLY%%LINEBREAK%Wenn ein anderes freundliches Schiff in Reichweite 1 angreift, darf es 1 seiner gewürfelten %HIT% in ein %CRIT% ändern."
    },
    "Expanded Cargo Hold": {
      name: "Erweiterter Ladebereich",
      text: "Ein Mal pro Runde darfst du, wenn du eine offene Schadenskarte erhältst, frei wählen, ob du sie vom Schadensstapel Bug oder Heck ziehen willst.",
      ship: "Medium-Transporter GR-75"
    },
    "Backup Shield Generator": {
      name: "Sekundärer Schildgenerator",
      text: "Am Ende jeder Runde kannst du 1 Energie ausgeben, um 1 Schild wiederaufzuladen (bis maximal zum Schildwert)."
    },
    "EM Emitter": {
      name: "EM-Emitter",
      text: "Wenn du bei einem Angriff die Schussbahn versperrst, bekommst der Verteidiger 3 zusätzliche Verteidigungswürfel (anstatt 1)."
    },
    "Frequency Jammer": {
      name: "Störsender (Fracht)",
      text: "Wenn du die Aktion Störsignal durchführst, wähle 1 feindliches Schiff ohne Stressmarker in Reichweite 1 des vom Störsignal betroffenen Schiffs. Das gewählte Schiff erhält 1 Stressmarker."
    },
    "Han Solo": {
      name: "Han Solo (Crew)",
      text: "%DE_REBELONLY%%LINEBREAK%Wenn du angreifst und den Verteidiger in Zielerfassung hast, kannst du diese Zielerfassung ausgeben, um all deine gewürfelten %FOCUS% in %HIT% zu ändern."
    },
    "Leia Organa": {
      text: "%DE_REBELONLY%%LINEBREAK%Zu Beginn der Aktivierungsphase kannst du diese Karte ablegen, damit alle freundlichen Schiffe, die ein rotes Manöver aufdecken, dieses bis zum Ende der Phase wie ein weißes Manöver behandeln dürfen."
    },
    "Targeting Coordinator": {
      text: "<strong>Energy:</strong> You may spend 1 energy to choose 1 friendly ship at Range 1-2.  Acquire a target lock, then assign the blue target lock token to the chosen ship."
    },
    "Raymus Antilles": {
      text: "%DE_HUGESHIPONLY%%LINEBREAK%%DE_REBELONLY%%LINEBREAK%Wähle zu Beginn der Aktivierungsphase 1 feindliches Schiff in Reichweite 1-3. Du kannst dir das gewählte Manöver dieses Schiffes ansehen. Wenn es weiß ist, bekommt dieses Schiff 1 Stressmarker."
    },
    "Gunnery Team": {
      name: "Bordschützenteam",
      text: "Einmal pro Runde kannst du beim Angreifen mit einer Sekundärwaffe 1 Energie ausgeben, um 1 gewürfelte Leerseite in ein %HIT% zu ändern."
    },
    "Sensor Team": {
      name: "Sensortechnikerteam",
      text: "Du kannst feindliche Schiffe in Reichweite 1-5 in die Zielerfassung nehmen (anstatt in Reichweite 1-3)."
    },
    "Engineering Team": {
      name: "Ingenieurteam",
      text: "Wenn du in der Aktivierungsphase ein %STRAIGHT% Manöver aufdeckst, bekommst du im Schritt \"Energie gewinnen\" 1 zusätzlichen Energiemarker."
    },
    "Lando Calrissian": {
      name: "Lando Calrissian (Crew)",
      text: "%DE_REBELONLY%%LINEBREAK%<strong>Aktion:</strong> Wirf 2 Verteidigungswürfel. Dein Schiff bekommt 1 Fokusmarker für jedes %FOCUS% und 1 Ausweichmarker für jedes %EVADE%."
    },
    "Mara Jade": {
      text: "%DE_IMPERIALONLY%%LINEBREAK%Am Ende der Kampfphase erhält jedes feindliche Schiff in Reichweite 1, das keine Stressmarker hat, einen Stressmarker."
    },
    "Fleet Officer": {
      name: "Flottenoffizier",
      text: "%DE_IMPERIALONLY%%LINEBREAK%<strong>Aktion:</strong> Wähle bis zu 2 freundliche Schiffe in Reichweite 1-2 und gib ihnen je 1 Fokusmarker. Dann erhältst du 1 Stressmarker."
    },
    "Targeting Coordinator": {
      name: "Zielkoordinator",
      text: "<strong>Energie:</strong> Du kannst 1 Energie ausgeben, um 1 freundliches Schiff in Reichweite1-2 zu wählen. Nimm dann ein Schiff in die Zielerfassung und gibt den blauen Zielerfassungsmarker dem gewählten Schiff."
    },
    "Lone Wolf": {
      name: "Einsamer Wolf",
      text: "Sobald du angreifst oder verteidigst und wenn keine anderen freundlichen Schiffe in Reichweite 1-2 sind, darfst du 1 gewürfelte Leerseite neu würfeln."
    },
    "Stay On Target": {
      name: "Am Ziel bleiben",
      text: "Sobald du ein Manöverrad aufdeckst, darfst du ein anderes Manöver mit gleicher Geschwindigkeit auf deinem Rad einstellen.<br /><br />Dieses Manöver wird wie ein rotes Manöver behandelt."
    },
    "Dash Rendar": {
      name: "Dash Rendar (Crew)",
      text: "%DE_REBELONLY%%LINEBREAK%Du darfst auch angreifen während du dich mit einem Hindernis überschneidest.<br /><br />Deine Schussbahn kann nicht versperrt werden."
    },
    '"Leebo"': {
      name: '"Leebo" (Crew)',
      text: "%DE_REBELONLY%%LINEBREAK%<strong>Aktion:</strong> Führe als freie Aktion einen Schub durch. Dann erhältst du 1 Ionenmarker."
    },
    "Ruthlessness": {
      name: "Erbarmungslos",
      text: "%DE_IMPERIALONLY%%LINEBREAK%Nachdem du mit einem Angriff getroffen hast, <strong>musst</strong> du 1 anderes Schiff in Reichweite 1 des Verteidigers (außer dir selbst) wählen. Das Schiff nimmt 1 Schaden."
    },
    "Intimidation": {
      name: "Furchteinflössend",
      text: "Die Wendigkeit feindlicher Schiffe sinkt um 1, solange du sie berührst."
    },
    "Ysanne Isard": {
      text: "%DE_IMPERIALONLY%%LINEBREAK%Wenn du zu Beginn der Kampfphase keine Schilde und mindestens 1 Schadenskarte hast, darfst du als freie Aktion ausweichen."
    },
    "Moff Jerjerrod": {
      text: "%DE_IMPERIALONLY%%LINEBREAK%Wenn du eine offene Schadenskarte erhältst, kannst du diese Aufwertungskarte oder eine andere %CREW%-Aufwertung ablegen, um die Schadenskarte umzudrehen (ohne dass der Kartentext in Kraft tritt)."
    },
    "Ion Torpedoes": {
      name: "Ionentorpedos",
      text: "<strong>Angriff (Zielerfassung):</strong> Gib deine Zielerfassungsmarker aus und lege diese Karte ab, um mit dieser Sekundärwaffe anzugreifen.<br /><br />Triffst du, erhalten alle Schiffe in Reichweite 1 des Verteidigers und der Verteidiger selbst je 1 Ionenmarker."
    },
    "Bodyguard": {
      name: "Leibwache",
      text: "%DE_SCUMONLY%%LINEBREAK%Zu Beginn der Kampfphase darfst du einen Fokusmarker ausgeben um ein freundliches Schiff in Reichweite 1 zu wählen, dessen Pilotenwert höher ist als deiner. Bis zum Ende der Runde steigt sein Wendigkeitswert um 1."
    },
    "Calculation": {
      name: "Berechnung",
      text: "Sobald du angreifst, darfst du einen Fokusmarker ausgeben, um 1 deiner %FOCUS% in ein %CRIT% zu ändern."
    },
    "Accuracy Corrector": {
      name: "Zielvisor",
      text: "Wenn du angreifst, darfst du während des Schritts \"Angriffswürfel modifizieren\" alle deine Würfelergebnisse negieren. Dann darfst du 2 %HIT% hinzufügen.%LINEBREAK%Deine Würfel können während dieses Angriffs nicht noch einmal modifiziert werden."
    },
    "Inertial Dampeners": {
      name: "Trägheitsdämpfer",
      text: "Sobald du dein Manöverrad aufdeckst, darfst du diese Karte ablegen, um stattdessen ein weißes [0%STOP%]-Manöver auszuführen. Dann erhältst du 1 Stressmarker."
    },
    "Flechette Cannon": {
      name: "Flechettekanonen",
      text: "<strong>Angriff:</strong> Greife 1 Schiffe an.%LINEBREAK%Wenn dieser Angriff trifft, nimmt das verteidigende Schiff 1 Schaden und erhält 1 Stressmarker (falls es noch keinen hat.) Dann werden <strong>alle</strong> Würfelergebnisse negiert."
    },
    '"Mangler" Cannon': {
      name: '"Mangler"-Kanonen',
      text: "<strong>Angriff:</strong> Greife 1 Schiff an.%LINEBREAK%Sobald du angreifst, darfst du 1 deiner %HIT% in ein %CRIT% ändern."
    },
    "Dead Man's Switch": {
      name: "Totmannschalter",
      text: "Sobald du zerstörst wirst, nimmt jedes Schiff in Reichweite 1 einen Schaden."
    },
    "Feedback Array": {
      name: "Rückkopplungsfeld",
      text: "In der Kampfphase darfst du statt einen Angriff durchzuführen 1 Ionenmarker und 1 Schaden nehmen, um ein feindliches Schiff in Reichweite 1 zu wählen. Das gewählte Schiff nimmt 1 Schaden."
    },
    '"Hot Shot" Blaster': {
      text: "<strong>Angriff:</strong> Lege diese Karte ab, um 1 Schiff (auch außerhalb deines Feuerwinkels) anzugreifen."
    },
    "Greedo": {
      text: "%DE_SCUMONLY%%LINEBREAK%In jeder Runde wird bei deinem ersten Angriff und deiner ersten Verteidigung die erste Schadenskarte offen zugeteilt."
    },
    "Salvaged Astromech": {
      name: "Abgewrackter Astromechdroide",
      text: "Sobald du eine Schadenskarte mit dem Attribut <strong>Schiff</strong> erhältst, darfst du sie sofort ablegen (bevor ihr Effekt abgehandelt wird).%LINEBREAK%Danach wird diese Aufwertungskarte abgelegt."
    },
    "Bomb Loadout": {
      name: "Bombenladung",
      text: "<span class=\"card-restriction\">Nur für Y-Wing.</span>%LINEBREAK%Füge deiner Aufwertungsleiste das %BOMB%-Symbol hinzu."
    },
    '"Genius"': {
      name: '"Genie"',
      text: "Wenn du eine Bombe ausgerüstet hast, die gelegt werden kann, sobald du ein Manöver aufdeckst, darfst du die Bombe legen, nachdem du dein Manöver ausgeführt hast."
    },
    "Unhinged Astromech": {
      name: "Ausgeklinkter Astromech-Droide",
      text: "Du darfst alle Manöver mit Geschwindigkeit 3 wie grüne Manöver behandeln."
    },
    "R4-B11": {
      text: "Sobald du angreifst, darfst du, falls du den Verteidiger in der Zielerfassung hast, den Zielerfassungsmarker ausgeben, um beliebig viele Verteidigungswürfel zu wählen. Diese muss der Verteidiger neu würfeln."
    },
    "Autoblaster Turret": {
      name: "Autoblastergeschütz",
      text: "<strong>Angriff:</strong> Greife 1 Schiff (auch außerhalb deines Feuerwinkels) an. %LINEBREAK%Deine %HIT% können von Verteidigungswürfeln nicht negiert werden. Der Verteidiger darf %CRIT% vor %HIT% negieren."
    },
    "R4 Agromech": {
      name: "R4-Agromech-Droide",
      text: "Sobald du angreifst, darfst du, nachdem du einen Fokusmarker ausgegeben hast, den Verteidiger in die Zielerfassung nehmen."
    },
    "K4 Security Droid": {
      name: "K4-Sicherheitsdroide",
      text: "%DE_SCUMONLY%%LINEBREAK%Nachdem du ein grünes Manöver ausgeführt hast, darfst du ein Schiff in die Zielerfassung nehmen."
    },
    "Outlaw Tech": {
      name: "Gesetzloser Techniker",
      text: "%DE_SCUMONLY%%LINEBREAK%Nachdem du ein rotes Manöver ausgeführt hast, darfst du deinem Schiff 1 Fokusmarker zuweisen."
    },
    "Advanced Targeting Computer": {
      name: "Verbesserter Zielcomputer",
      text: "<span class=\"card-restriction\">Nur für TIE Advanced</span>%LINEBREAK%Sobald du mit deiner Primärwaffe angreifst, darfst du deinem Würfelwurf 1 %CRIT% hinzufügen, wenn du den Verteidiger in der Zielerfassung hast. Wenn du das tust, kannst du während dieses Angriffs keine Zielerfassungen ausgeben."
    },
    "Ion Cannon Battery": {
      name: "Ionengeschützbatterie",
      text: "<strong>Angriff (Energie):</strong> Gib 2 Energie von dieser Karte aus, um diesen Angriff durchzuführen. Wenn dieser Angriff trifft, nimmt der Verteidiger 1 kritischen Schaden und erhält 1 Ionenmarker. Dann werden <strong>alle</strong> Würfelergebnisse negiert."
    },
    "Extra Munitions": {
      name: "Ersatzmunition",
      text: "Sobald du diese Karte ausrüstest, lege 1 Munitionsmarker auf jede ausgerüstete %TORPEDO%, %MISSILE% oder %BOMB% Aufwertungskarte. Sobald du angewiesen wirst eine Aufwertungskarte abzulegen, darfst du stattdessen 1 Munitionsmarker von der entsprechenden Karte ablegen."
    },
    "Cluster Mines": {
      name: "Clusterminen",
      text: "<strong>Aktion</strong>: Lege diese Karte ab, um 1 Satz Clusterminenmarker zu <strong>legen</strong>.<br /><br />Ein Clusterminenmarker <strong>detoniert</strong>, sobald sich eine Schiffsbasis oder Manöverschablone mit diesem Marker überschneidet."
    },
    "Glitterstim": {
      name: "Glitzerstim",
      text: "Zu Beginn der Kampfphase darfst du diese Karte ablegen und bekommst 1 Stressmarker. Tust du das , darfst du bis zum Ende der Runde, sobald du angreifst oder verteidigst, alle deine %FOCUS% in %HIT% oder %EVADE% ändern."
    },
    "Grand Moff Tarkin": {
      name: "Grossmoff Tarkin",
      text: "%DE_HUGESHIPONLY% %DE_IMPERIALONLY%%LINEBREAK%Zu Beginn der Kampfphase darfst du ein anderes Schiff in Reichweite 1-4 wählen. Entweder weist du ihm 1 Fokusmarker zu oder du entfernst 1 Fokusmarker von ihm."
    },
    "Captain Needa": {
      text: "%DE_HUGESHIPONLY% %DE_IMPERIALONLY%%LINEBREAK%Wenn du dich in der Aktivierungsphase mit einem Hindernis überschneidest, erhältst du keine offene Schadenskarte. Stattdessen wirfst du 1 Angriffswürfel. Bei %HIT% oder %CRIT% nimmst du 1 Schaden."
    },
    "Admiral Ozzel": {
      text: "%DE_HUGESHIPONLY% %DE_IMPERIALONLY%%LINEBREAK%<strong>Energie:</strong> Du darfst bis zu 3 Schilde von deinem Schiff entfernen. Für jedes entfernte Schild erhältst du 1 Energie."
    },
    "Emperor Palpatine": {
      name: "Imperator Palpatine",
      text: "%DE_IMPERIALONLY%%LINEBREAK%Ein Mal pro Runde darfst du das Ergebnis eines Würfels, den ein freundliches Schiff geworfen hat, in ein beliebiges anderes Ergebnis ändern. Dieses Ergebnis kann nicht nochmal modifiziert werden."
    },
    "Bossk": {
      name: "Bossk (Crew)",
      text: "%DE_SCUMONLY%%LINEBREAK%Nachdem du einen Angriff durchgeführt hast, der nicht geroffen hat, <strong>musst</strong> du 1 Stressmarker bekommen, wenn du keine Stressmarker hast. Weise dann deinem Schiff 1 Fokusmarker zu und nimm den Verteidiger in die Zielerfassung."
    },
    "Lightning Reflexes": {
      name: "Blitzschnelle Reflexe",
      text: "%DE_SMALLSHIPONLY%%LINEBREAK%Nachdem du ein weißes oder grünes Manöver von deinem Rad ausgeführt hast, darfst du diese Karte ablegen, um dein Schiff um 180&deg; zu drehen. Dann erhältst du 1 Stressmarker <strong>nach</strong> dem Schritt \"Stress des Piloten überprüfen\"."
    },
    "Twin Laser Turret": {
      name: "Zwillingslasergeschütz",
      text: "<strong>Angriff:</strong> Führe diesen Angriff zwei Mal durch (auch gegen ein Schiff außerhalb deines Feuerwinkels). Jedes Mal wenn dieser Angriff trifft, nimmt der Verteidiger 1 Schaden. Dann werden <strong>alle</strong> Würfelergebnisse negiert."
    },
    "Plasma Torpedoes": {
      name: "Plasma Torpedos",
      text: "<strong>Angriff (Zielerfassung):</strong> Gib deinen Zielerfassungsmarker aus und lege diese Karte ab, um diesen Angriff durchzuführen.<br /><br />Falls dieser Angriff trifft, entferne 1 Schildmarker des Verteidigers, nachdem du ihm Schaden zugefügt hast."
    },
    "Ion Bombs": {
      name: "Ionenbomben",
      text: "Sobald du dein Manöverrad aufdeckst, darfst du diese Karte ablegen, um 1 Ionenbombenmarker zu <strong>legen</strong>.<br /><br /> Der Marker <strong>detoniert</strong> am Ende der Aktivierungsphase."
    },
    "Conner Net": {
      name: "Connernetz",
      text: "<strong>Aktion:</strong> Lege diese Karte ab, um 1 Connernetzmarker zu <strong>legen</strong>.<br /><br /> Der Marker <strong>detoniert</strong>, sobald sich eine Schiffsbasis oder Manöverschablone mit dem Marker überschneidet."
    },
    "Bombardier": {
      name: "Bombenschütze",
      text: "Sobald du eine Bombe legst, darfst du die (%STRAIGHT% 2)-Schablone anstatt der (%STRAIGHT% 1)-Schablone verwenden."
    },
    'Crack Shot': {
      name: "Meisterhafter Schuss",
      text: 'Sobald du ein Schiff innerhalb deines Feuerwinkels angreifst, darfst du diese Karte ablegen um 1 gewürfeltes %EVADE% des Verteidigers zu negieren.'
    },
    "Advanced Homing Missiles": {
      name: "Verstärkte Lenkraketen",
      text: "<strong>Angriff (Zielerfassung):</strong> Lege diese Karte ab, um diesen Angriff durchzuführen.%LINEBREAK%Falls dieser Angriff triffst, teile dem Verteidiger 1 offene Schadenskarte zu. Dann werden <strong>alle</strong> Würfelergebnisse negiert."
    },
    'Agent Kallus': {
      text: '%DE_IMPERIALONLY%%LINEBREAK%At the start of the first round, choose 1 enemy small or large ship.  When attacking or defending against that ship, you may change 1 of your %FOCUS% results to a %HIT% or %EVADE% result.'
    },
    'XX-23 S-Thread Tracers': {
      text: "<strong>Attack (focus):</strong> Discard this card to perform this attack.  If this attack hits, each friendly ship at Range 1-2 of you may acquire a target lock on the defender.  Then cancel <strong>all</strong> dice results."
    },
    "Tractor Beam": {
      text: "<strong>Attack:</strong> Attack 1 ship.%LINEBREAK%If this attack hits, the defender receives 1 tractor beam token.  Then cancel <strong>all</strong> dice results."
    },
    "Cloaking Device": {
      text: "%DE_SMALLSHIPONLY%%LINEBREAK%<strong>Action:</strong> Perform a free cloak action.%LINEBREAK%At the end of each round, if you are cloaked, roll 1 attack die.  On a %FOCUS% result, discard this card, then decloak or discard your cloak token."
    },
    "Shield Technician": {
      name: "Schildtechniker",
      text: "%DE_HUGESHIPONLY%%LINEBREAK%Sobald du die Aktion Aufladen durchführst, kannst du wählen, wie viel Energie du ausgeben möchtest, anstatt alle Energie auszugeben."
    },
    "Weapons Guidance": {
      name: "Zielführung",
      text: "Sobald du angreifst, darfst du einen Fokus ausgeben, um 1 deiner gewürfelten Leerseiten in %HIT% zu ändern."
    },
    "BB-8": {
      text: "Sobald du eine grünes Manöver aufdeckst, darfst du als freie Aktion eine Fassrolle ausführen."
    },
    "R5-X3": {
      text: "Bevor du dein Manöver aufdeckst, darfst du diese Karte ablegen, um Hindernisse bis zum Ende der Runde zu ignorieren."
    },
    "Wired": {
      name: "Aufgedreht",
      text: "Sobald du angreifst oder verteidigst, und wenn du gestresst bist, darfst du 1 oder mehrere %FOCUS% neu würfeln."
    },
    'Cool Hand': {
      name: "Sichere Hand",
      text: 'Sobald du einen Stressmarker erhältst, darfst du diese Karte ablegen, um deinem Schiff 1 Fokus- oder Ausweichmarker zuzuweisen.'
    },
    'Juke': {
      name: "Finte",
      text: '%DE_SMALLSHIPONLY%%LINEBREAK%Sobald du angreifst und falls du einen Ausweichmarker hast, darfst du 1 %EVADE% des Verteidigers in ein %FOCUS% ändern.'
    },
    'Comm Relay': {
      name: "Kommunikations-Relais",
      text: 'Du kannst nicht mehr als 1 Ausweichmarker haben.%LINEBREAK%Während der Endphase wird ein nicht verwendeter Ausweichmarker nicht entfernt.'
    },
    'Dual Laser Turret': {
      ship: "Kreuzer der Gozanti-Klasse",
      name: "Doppellasergeschütz",
      text: '%DE_GOZANTIONLY%%LINEBREAK%<strong>Angriff (Energie):</strong> Gib 1 Energie von dieser Karte aus, um diesen Angriff gegen 1 Schiff durchzuführen (auch außerhalb deines Feuerwinkels).'
    },
    'Broadcast Array': {
      ship: "Kreuzer der Gozanti-Klasse",
      name: "Sendephalanx",
      text: '%DE_GOZANTIONLY%%LINEBREAK%Deine Aktionsleiste erhält das %JAM%-Aktionssymbol.'
    },
    'Rear Admiral Chiraneau': {
      name: "Konteradmiral Chiraneau",
      text: '%HUGESHIPONLY% %IMPERIALONLY%%LINEBREAK%<strong>Aktion:</strong> Führe ein weißes (%STRAIGHT% 1)-Manöver aus.'
    },
    'Ordnance Experts': {
      name: "Flugkörperexperten",
      text: 'Sobald ein freundliches Schiff in Reichweite 1-3 einen Angriff mit einer %TORPEDO%- oder %MISSILE%-Sekundärwaffe durchführt, darf es ein Mal pro Runde 1 seiner Leerseiten in ein %HIT% ändern.'
    },
    'Docking Clamps': {
      ship: "Kreuzer der Gozanti-Klasse",
      name: "Andockklammern",
      text: '%DE_GOZANTIONLY% %DE_LIMITED%%LINEBREAK%An diesem Schiff können bis zu 4 TIE-Jäger, TIE-Abfangjäger, TIE-Bomber oder TIE-Turbojäger andocken. Alle angedockten Schiffe müssen denselben Schiffstyp haben.'
    },
    '"Zeb" Orrelios': {
      text: "%REBELONLY%%LINEBREAK%Enemy ships inside your firing arc that you are touching are not considered to be touching you when either you or they activate during the Combat phase."
    },
    'Kanan Jarrus': {
      text: "%REBELONLY%%LINEBREAK%Once per round, after a friendly ship at Range 1-2 executes a white maneuver, you may remove 1 stress token from that ship."
    },
    'Reinforced Deflectors': {
      text: "%LARGESHIPONLY%%LINEBREAK%After you suffer 3 or more damage from an attack, recover one shield (up to your shield value)."
    },
    'Dorsal Turret': {
      text: "<strong>Attack:</strong> Attack 1 ship (even a ship outside your firing arc).%LINEBREAK%If the target of this attack is at Range 1, roll 1 additional attack die."
    },
    'Targeting Astromech': {
      name: "Zielender Astromech",
      text: 'Nachdem du eine rotes Manöver ausgeführt hast, darfst du ein Schiff in die Zielerfassung nehmen.'
    },
    'Hera Syndulla': {
      text: "%REBELONLY%%LINEBREAK%You may reveal and execute red maneuvers even while you are stressed."
    },
    'Ezra Bridger': {
      text: "%REBELONLY%%LINEBREAK%When attacking, if you are stressed, you may change 1 of your %FOCUS% results to a %CRIT% result."
    },
    'Sabine Wren': {
      text: "%REBELONLY%%LINEBREAK%Your upgrade bar gains the %BOMB% upgrade icon.  Once per round, before a friendly bomb token is removed, choose 1 enemy ship at Range 1 of that token. That ship suffers 1 damage."
    },
    '"Chopper"': {
      text: "%REBELONLY%%LINEBREAK%You may perform actions even while you are stressed.%LINEBREAK%After you perform an action while you are stressed, suffer 1 damage."
    },
    'Construction Droid': {
      name: "Baudroide",
      text: '%HUGESHIPONLY% %DE_LIMITED%%LINEBREAK%Sobald du die Aktion Aufladen durchführst, darfst du 1 Energie ausgeben, um 1 verdeckte Schadenskarte abzulegen.'
    },
    'Cluster Bombs': {
      name: "Clusterbomben",
      text: 'Nachdem du dich verteidigt hast, darfst du diese Karte ablegen. Wenn du dies tust, wirft jedes andere Schiff in Reichweite 1 der verteidigenden Sektion 2 Angriffswürfel und nimmt allen gewürfelten Schaden (%HIT%) und kritischen Schaden (%CRIT%).'
    },
    "Adaptability (+1)": {
      text: "<span class=\"card-restriction\">Dual card.</span>%LINEBREAK%Increase your pilot skill value by 1."
    },
    "Adaptability (-1)": {
      text: "<span class=\"card-restriction\">Dual card.</span>%LINEBREAK%Decrease your pilot skill value by 1."
    },
    "Electronic Baffle": {
      text: "When you receive a stress token or an ion token, you may suffer 1 damage to discard that token."
    },
    "4-LOM": {
      text: "%SCUMONLY%%LINEBREAK%When attacking, during the \"Modify Attack Dice\" step, you may receive 1 ion token to choose 1 of the defender's focus or evade tokens.  That token cannot be spent during this attack."
    },
    "Zuckuss": {
      text: "%SCUMONLY%%LINEBREAK%When attacking, you may receive any number of stress tokens to choose an equal number of defense dice.  The defender must reroll those dice."
    },
    'Rage': {
      text: "<strong>Action:</strong> Assign 1 focus token to your ship and receive 2 stress tokens.  Until the end of the round, when attacking, you may reroll up to 3 attack dice."
    },
    "Attanni Mindlink": {
      text: "%SCUMONLY%%LINEBREAK%Each time you are assigned a focus or stress token, each other friendly ship with Attanni Mindlink must also be assigned the same type of token if it does not already have one."
    },
    "Boba Fett": {
      text: "%SCUMONLY%%LINEBREAK%After performing an attack, if the defender was dealt a faceup Damage card, you may discard this card to choose and discard 1 of the defender's Upgrade cards."
    },
    "Dengar": {
      text: "%SCUMONLY%%LINEBREAK%When attacking, you may reroll 1 attack die.  If the defender is a unique pilot, you may instead reroll up to 2 attack dice."
    },
    '"Gonk"': {
      text: "%SCUMONLY%%LINEBREAK%<strong>Action:</strong> Place 1 shield token on this card.%LINEBREAK%<strong>Action:</strong> Remove 1 shield token from this card to recover 1 shield (up to your shield value)."
    },
    "R5-P8": {
      text: "Once per round, after defending, you may roll 1 attack die.  On a %HIT% result, the attacker suffers 1 damage.  On a %CRIT% result, you and the attacker each suffer 1 damage."
    },
    'Thermal Detonators': {
      text: "When you reveal your maneuver dial, you may discard this card to <strong>drop</strong> 1 thermal detonator token.%LINEBREAK%This token <strong>detonates</strong> at the end of the Activation phase.%LINEBREAK%<strong>Thermal Detonator Token:</strong> When this bomb token detonates, each ship at Range 1 of the token suffers 1 damage and receives 1 stress token.  Then discard this token."
    },
    "Overclocked R4": {
      text: "During the Combat phase, when you spend a focus token, you may receive 1 stress token to assign 1 focus token to your ship."
    }
  };
  modification_translations = {
    "Stealth Device": {
      name: "Tarnvorrichtung",
      text: "Dein Wendigkeitswert steigt um 1. Lege diese Karte ab, wenn du von einem Angriff getroffen wirst."
    },
    "Shield Upgrade": {
      name: "Verbesserte Schilde",
      text: "Dein Schildwert steigt um 1."
    },
    "Engine Upgrade": {
      name: "Verbessertes Triebwerk",
      text: "Füge deiner Aktionsleiste ein %BOOST%-Symbol hinzu."
    },
    "Anti-Pursuit Lasers": {
      name: "Kurzstreckenlaser",
      text: "%DE_LARGESHIPONLY%%LINEBREAK%Nachdem ein feindliches Schiff ein Manöver ausgeführt hat, das zur Überschneidung mit deinem Schiff führt, wirf 1 Angriffswürfel. Bei %HIT% oder %CRIT% nimmt das feindliche Schiff 1 Schaden."
    },
    "Targeting Computer": {
      name: "Zielerfassungssystem",
      text: "Deine Aktionsleiste erhält das %TARGETLOCK%-Symbol."
    },
    "Hull Upgrade": {
      name: "Verbesserte Hülle",
      text: "Erhöhe deinen Hüllenwert um 1."
    },
    "Munitions Failsafe": {
      name: "Ausfallsichere Munition",
      text: "Wenn du mit einer Sekundärwaffe angreifst, deren Kartentext besagt, dass sie zum Angriff abgelegt werden muss, legst du sie nur ab, falls du triffst."
    },
    "Stygium Particle Accelerator": {
      name: "Stygium-Teilchen-Beschleuniger",
      text: "immer wenn du dich enttarnst oder die Aktion Tarnen durchführst, darfst du als freie Aktion ausweichen."
    },
    "Advanced Cloaking Device": {
      ship: "TIE-Phantom",
      name: "Verbesserte Tarnvorrichtung",
      text: "<span class=\"card-restriction\">Nur für TIE-Phantom.</span>%LINEBREAK%Nachdem du angegriffen hast, darfst du dich als freie Aktion tarnen."
    },
    "Combat Retrofit": {
      name: "Umrüstung für den Kampfeinsatz",
      ship: "Medium-Transporter GR-75",
      text: "Erhöhe deinen Hüllenwert um 2 und deinen Schildwert um 1."
    },
    "B-Wing/E2": {
      text: "Füge deiner Aufwertungsleiste das %CREW%-Symbol hinzu."
    },
    "Countermeasures": {
      name: "Gegenmassnahmen",
      text: "%DE_LARGESHIPONLY%%LINEBREAK%Zu Beginn der Kampfphase kannst du diese Karte ablegen, um deine Wendigkeit bis zum Ende der Runde um 1 zu erhöhen. Dann darfst du 1 feindliche Zielerfassung von deinem Schiff entfernen."
    },
    "Experimental Interface": {
      name: "Experimentelles Interface",
      text: "Ein Mal pro Runde darfst du nach dem Durchführen einer Aktion 1 ausgerüstete Aufwertungskarte mit dem Stichwort \"<strong>Aktion:</strong>\" benutzen (dies zählt als freie Aktion). Dann erhältst du 1 Stressmarker."
    },
    "Tactical Jammer": {
      name: "Taktischer Störsender",
      text: "%DE_LARGESHIPONLY%%LINEBREAK%Dein Schiff kann die feindliche Schussbahn versperren."
    },
    "Autothrusters": {
      name: "Automatische Schubdüsen",
      text: "Sobald du verteidigst und jenseits von Reichweite 2 oder außerhalb des Feuerwinkels des Angreifers bist, darfst du 1 deiner Leerseiten in ein %EVADE% ändern. Du darfst diese Karte nur ausrüsten, wenn du das %BOOST%-Aktionssymbol hast."
    },
    "Advanced SLAM": {
      name: "Verbesserter SLAM",
      text: "Nachdem du die Aktion SLAM durchgeführt hast, darfst du 1 freie Aktion durchführen, falls du dich nicht mit einem Hindernis oder anderen Schiff überschnitten hast."
    },
    "Twin Ion Engine Mk. II": {
      name: "Zwillings-Ionenantrieb MK. II",
      text: "Du darfst alle Drehmanöver (%BANKLEFT% oder %BANKRIGHT%) als grüne Manöver behandeln."
    },
    "Maneuvering Fins": {
      name: "Steuertragflächen",
      text: "Sobald du ein Wendemanöver (%TURNLEFT% oder %TURNRIGHT%) aufdeckst, darfst du das entsprechende Drehmanöver (%BANKLEFT% oder %BANKRIGHT%) mit gleicher Geschwindigkeit auf deinem Manöverrad einstellen."
    },
    "Ion Projector": {
      name: "Ionenprojektor",
      text: "%DE_LARGESHIPONLY%%LINEBREAK%Nachdem ein feindliches Schiff ein Manöver ausgeführt hat, das zur Überschneidung mit deinem Schiff führte, wirf 1 Angriffswürfel. Bei %HIT% oder %CRIT% bekommt das feindliche Schiff 1 Ionenmarker."
    },
    'Integrated Astromech': {
      text: '<span class="card-restriction">Nur für X-Wing.</span>%LINEBREAK%When you are dealt a Damage card, you may discard 1 of your %ASTROMECH% Upgrade cards to discard that Damage card.'
    },
    'Optimized Generators': {
      name: "Optimierte Generatoren",
      text: '%HUGESHIPONLY%%LINEBREAK%Ein Mal pro Runde erhältst du 2 Energie, sobald du Energie auf einer ausgerüsteten Aufwertung zuordnest.'
    },
    'Automated Protocols': {
      name: "Vollautomatische Protokolle",
      text: '%HUGESHIPONLY%%LINEBREAK%Ein Mal pro Runde darfst du, nachdem du eine Aktion durchgeführt hast (außer Aufladen und Verstärken), 1 Energie ausgeben, um Aufladen oder Verstärken als freie Aktion durchzuführen.'
    },
    'Ordnance Tubes': {
      name: "Abschussrohre",
      text: '%HUGESHIPONLY%%LINEBREAK%Du darfst jedes deiner %HARDPOINT%-Aufwertungssymbole wie ein %TORPEDO%- oder %MISSILE%- Symbol behandeln.%LINEBREAK%Sobald du angewiesen wirst eine %TORPEDO%- oder %MISSILE%-Aufwertung abzulegen, lege sie nicht ab.'
    },
    'Long-Range Scanners': {
      text: 'You can acquire target locks on ships at Range 3 and beyond.  You cannot acquire target locks on ships at Range 1-2.  You can equip this card only if you have %TORPEDO% and %MISSILE% in your upgrade bar.'
    },
    "Guidance Chips": {
      text: "Once per round, when attacking with a %TORPEDO% or %MISSILE% secondary weapon, you may change 1 die result to a %HIT% result (or a %CRIT% result if your primary weapon value is \"3\" or higher)."
    }
  };
  title_translations = {
    "Slave I": {
      name: "Sklave I",
      text: "<span class=\"card-restriction\">Nur für Firespray-31.</span>%LINEBREAK%Füge deiner Aktionsleiste ein %TORPEDO%-Symbol hinzu."
    },
    "Millennium Falcon": {
      name: "Millennium Falke",
      text: "<span class=\"card-restriction\">Nur für YT-1300.</span>%LINEBREAK%Füge deiner Aktionsleiste ein %EVADE%-Symbol hinzu."
    },
    "Moldy Crow": {
      text: "<span class=\"card-restriction\">Nur für HWK-290.</span>%LINEBREAK%In der Endphase werden von diesem Schiff keine unbenutzen Fokusmarker entfernt."
    },
    "ST-321": {
      ship: "Raumfähre der Lambda-Klasse",
      text: "<span class=\"card-restriction\">Nur für Raumfähren der Lamda-Klasse.</span>%LINEBREAK%Wenn du eine Zielerfassung durchführst, darfst du ein beliebiges feindliches Schiff auf der Spielfläche als Ziel erfassen."
    },
    "Royal Guard TIE": {
      name: "TIE der Roten Garde",
      ship: "TIE-Abfangjäger",
      text: "<span class=\"card-restriction\">Nur für TIE-Abfangjäger.</span>%LINEBREAK%Du kannst bis zu 2 verschiedene Modifikationen verwenden (statt einer).<br /><br />Du kannst diese Karte nicht verwenden, wenn der Pilotenwert \"4\" oder kleiner ist."
    },
    "Dodonna's Pride": {
      name: "Dodonnas Stolz",
      ship: "CR90-Korvette (Bug)",
      text: "<span class=\"card-restriction\">Nur für CR90-Korvette (Bug).</span>%LINEBREAK%Wenn du die Aktion Koordination durchführst, kannst du 2 freundliche Schiffe wählen (anstatt 1). Jedes dieser Schiffe darf 1 freie Aktion durchführen."
    },
    "A-Wing Test Pilot": {
      name: "Erfahrener Testpilot",
      text: "<span class=\"card-restriction\">Nur für A-Wing.</span>%LINEBREAK%Füge deiner Aufwertungsleiste 1 %ELITE%-Symbol hinzu.<br /><br />Du darfst jede %ELITE%-Aufwertung nur ein Mal ausrüsten. Du kannst diese Karte nicht verwenden, wenn dein Pilotenwert \"1\" oder niedriger ist."
    },
    "Tantive IV": {
      ship: "CR90-Korvette (Bug)",
      text: "<span class=\"card-restriction\">Nur für CR90-Korvette (Bug).</span>%LINEBREAK%Die Aufwertungsleiste deiner Bugsektion erhält 1 zusätzliches %CREW% und 1 zusätzliches %TEAM% ."
    },
    "Bright Hope": {
      ship: "Medium-Transporter GR-75",
      text: "<span class=\"card-restriction\">Nur für Medium-Transporter GR-75.</span>%LINEBREAK%Wenn neben deiner Bugsektion ein Verstärkungsmarker liegt, fügt er 2 %EVADE% hinzu (anstatt 1)."
    },
    "Quantum Storm": {
      ship: "Medium-Transporter GR-75",
      text: "<span class=\"card-restriction\">Nur für Medium-Transporter GR-75.</span>%LINEBREAK%Wenn du zu Beginn der Endphase 1 Energiemarker oder weniger hast, gewinnst du 1 Energiemarker."
    },
    "Dutyfree": {
      ship: "Medium-Transporter GR-75",
      text: "<span class=\"card-restriction\">Nur für Medium-Transporter GR-75.</span>%LINEBREAK%Bei der Aktion Störsignal kannst du ein feindliches Schiff in Reichweite 1-3 (statt 1-2) wählen."
    },
    "Jaina's Light": {
      name: "Jainas Licht",
      ship: "CR90-Korvette (Bug)",
      text: "<span class=\"card-restriction\">Nur für CR90-Korvette (Bug).</span>%LINEBREAK%Wenn du verteidigst, darfst du einmal pro Angriff eine soeben erhaltene, offene Schadenskarte ablegen und dafür eine neue offene Schadenskarte ziehen."
    },
    "Outrider": {
      text: "<span class=\"card-restriction\">Nur für YT-2400.</span>%LINEBREAK%Solange du eine %CANNON%-Aufwertung ausgerüstet hast, kannst du deine Primärwaffen <strong>nicht</strong> verwenden. Dafür darfst du mit %CANNON%-Sekundärwaffen auch Ziele außerhalb deines Feuerwinkels angreifen."
    },
    "Dauntless": {
      text: "<span class=\"card-restriction\">Nur für VT-49 Decimator.</span>%LINEBREAK%Nach dem Ausführen eines Manövers, das zur Überschneidung mit einem anderen Schiff geführt hat, darfst du 1 freie Aktion durchführen. Dann erhältst du 1 Stressmarker."
    },
    "Virago": {
      ship: "SternenViper",
      text: "<span class=\"card-restriction\">Nur für SternenViper.</span>%LINEBREAK%Füge deiner Aufwertungsleiste ein %SYSTEM%- und ein %ILLICIT%-Symbol hinzu.%LINEBREAK%Du kannst diese Karte nicht ausrüsten, wenn dein Pilotenwert \"3\" oder niedriger ist."
    },
    '"Heavy Scyk" Interceptor (Cannon)': {
      ship: "M3-A Abfangjäger",
      name: '"Schwerer Scyk"-Abfangjäger (Kannone)',
      text: "<span class=\"card-restriction\">Nur für M3-A-Abfangjäger.</span>%LINEBREAK%Füge deiner Aufwertungsleiste eines der folgenden Symbole hinzu: %CANNON%, %TORPEDO%, oder %MISSILE%."
    },
    '"Heavy Scyk" Interceptor (Torpedo)': {
      ship: "M3-A Abfangjäger",
      name: '"Schwerer Scyk"-Abfangjäger (Torpedo)',
      text: "<span class=\"card-restriction\">Nur für M3-A-Abfangjäger.</span>%LINEBREAK%Füge deiner Aufwertungsleiste eines der folgenden Symbole hinzu: %CANNON%, %TORPEDO%, oder %MISSILE%."
    },
    '"Heavy Scyk" Interceptor (Missile)': {
      ship: "M3-A Abfangjäger",
      name: '"Schwerer Scyk"-Abfangjäger (Rakete)',
      text: "<span class=\"card-restriction\">Nur für M3-A-Abfangjäger.</span>%LINEBREAK%Füge deiner Aufwertungsleiste eines der folgenden Symbole hinzu: %CANNON%, %TORPEDO%, oder %MISSILE%."
    },
    "IG-2000": {
      text: "<span class=\"card-restriction\">Nur für Aggressor.</span>%LINEBREAK%Du bekommst die Pilotenfähigkeiten aller anderen freundlichen Schiffe mit der Aufwertungskarte <em>IG-2000</em> (zusätzlich zu deiner eigenen Pilotenfähigkeit)."
    },
    "BTL-A4 Y-Wing": {
      name: "BTL-A4-Y-Wing",
      text: "<span class=\"card-restriction\">Nur für Y-Wing.</span>%LINEBREAK%Du darfst Schiffe außerhalb deines Feuerwinkels nicht angreifen. Nachdem du einen Angriff mit deinen Primärwaffen durchgeführt hast, darfst du sofort einen weiteren Angriff mit einer %TURRET%-Sekundärwaffe durchführen."
    },
    "Andrasta": {
      text: "<span class=\"card-restriction\">Nur für Firespray-31.</span>%LINEBREAK%Füge deiner Aufwertungsleiste zwei weitere %BOMB%-Symbole hinzu."
    },
    "TIE/x1": {
      text: "<span class=\"card-restriction\">Nur für TIE Advanced.</span>%LINEBREAK%Füge deiner Aufwertungsleiste ein %SYSTEM%-Symbol hinzu.%LINEBREAK%Wenn du eine %SYSTEM%-Aufwertung ausrüstest, sinken deren Kommandopunkte um 4 (Minimum 0)."
    },
    "Hound's Tooth": {
      name: "Reisszahn",
      text: "<span class=\"card-restriction\">Nur für YV-666.</span>%LINEBREAK%Nachdem du zerstörst worden bist, darfst du das Schiff <em>Nashtahwelpe</em> <strong>absetzen</strong>, bevor du von der Spielfläche entfernt wirst.%LINEBREAK%Es darf diese Runde nicht angreifen."
    },
    "Ghost": {
      text: "<span class=\"card-restriction\">Nur für VCX-100.</span>%LINEBREAK%Equip the <em>Phantom</em> title card to a friendly Attack Shuttle and dock it to this ship.%LINEBREAK%After you execute a maneuver, you may deploy it from your rear guides."
    },
    "Phantom": {
      text: "While you are docked, the <em>Ghost</em> can perform primary weapon attacks from its special firing arc, and, at the end of the Combat phase, it may perform an additional attack with an equipped %TURRET%. If it performs this attack, it cannot attack again this round."
    },
    "TIE/v1": {
      text: "<span class=\"card-restriction\">Nur für TIE Advanced Prototype.</span>%LINEBREAK%After you acquire a target lock, you may perform a free evade action."
    },
    "Mist Hunter": {
      text: "<span class=\"card-restriction\">Nur für G-1A Starfighter.</span>%LINEBREAK%Your upgrade bar gains the %BARRELROLL% Upgrade icon.%LINEBREAK%You <strong>must</strong> equip 1 \"Tractor Beam\" Upgrade card (paying its squad point cost as normal)."
    },
    "Punishing One": {
      text: "<span class=\"card-restriction\">Nur für JumpMaster 5000.</span>%LINEBREAK%Increase your primary weapon value by 1."
    },
    "Assailer": {
      ship: "Korv. der Sturm-Klasse (Heck)",
      name: "Sturmbringer",
      text: "<span class=\"card-restriction\">Nur für Korvetten der <em>Sturm</em>-Klasse (Heck).</span>%LINEBREAK%Sobald du verteidigst und wenn die als Ziel bestimmten Sektion einen Verstärkungsmarker hat, darfst du 1 %FOCUS% in ein %EVADE% ändern."
    },
    "Instigator": {
      ship: "Korv. der Sturm-Klasse (Heck)",
      name: "Hetzer",
      text: "<span class=\"card-restriction\">Nur für Korvetten der <em>Sturm</em>-Klasse (Heck).</span>%LINEBREAK%Nachdem du die Aktion Aufladen durchgeführt hast, lade 1 weiteres Schild wieder auf."
    },
    "Impetuous": {
      ship: "Korv. der Sturm-Klasse (Heck)",
      name: "Ungestüm",
      text: "<span class=\"card-restriction\">Nur für Korvetten der <em>Sturm</em>-Klasse (Heck).</span>%LINEBREAK%Nachdem du einen Angriff durchgeführt hast, der ein feindliches Schiff zerstört hat, darfst du ein Schiff in die Zielerfassung nehmen.."
    },
    'TIE/x7': {
      ship: "TIE-Jagdbomber",
      text: '<span class="card-restriction">TIE Defender only.</span>%LINEBREAK%Your upgrade bar loses the %CANNON% and %MISSILE% upgrade icons.%LINEBREAK%After executing a 3-, 4-, or 5-speed maneuver, you may assign 1 evade token to your ship.'
    },
    'TIE/D': {
      ship: "TIE-Jagdbomber",
      text: '<span class="card-restriction">TIE Defender only.</span>%LINEBREAK%Once per round, after you perform an attack with a %CANNON% secondary weapon that costs 3 or fewer squad points, you may perform a primary weapon attack.'
    },
    'TIE Shuttle': {
      ship: "TIE-Bomber",
      text: '<span class="card-restriction">TIE Bomber only.</span>%LINEBREAK%Your upgrade bar loses all %TORPEDO%, %MISSILE%, and %BOMB% upgrade icons and gains 2 %CREW% upgrade icons.  You cannot equip a %CREW% Upgrade card that costs more than 4 squad points.'
    },
    'Requiem': {
      ship: "Kreuzer der Gozanti-Klasse",
      text: '%DE_GOZANTIONLY%%LINEBREAK%Sobald du ein Schiff startest, wird es bis zum Ende der Runde behandelt, als hätte es einen Pilotenwert von 8.'
    },
    'Vector': {
      ship: "Kreuzer der Gozanti-Klasse",
      name: "Vektor",
      text: '%DE_GOZANTIONLY%%LINEBREAK%Nachdem du ein Manöver ausgeführt hast, darfst du bis zu 4 angedockte Schiffe starten (anstatt 2).'
    },
    'Suppressor': {
      ship: "Kreuzer der Gozanti-Klasse",
      name: "Unterdrücker",
      text: '%DE_GOZANTIONLY%%LINEBREAK%Ein Mal pro Runde darfst du, nachdem du ein feindliches Schiff in die Zielerfassung genommen hast, 1 Fokus-, Ausweich- oder blaue Zielerfassungsmarker von dem Schiff entfernen.'
    }
  };
  return exportObj.setupCardData(basic_cards, pilot_translations, upgrade_translations, modification_translations, title_translations);
};

exportObj = typeof exports !== "undefined" && exports !== null ? exports : this;

if (exportObj.codeToLanguage == null) {
  exportObj.codeToLanguage = {};
}

exportObj.codeToLanguage.en = 'English';

if (exportObj.translations == null) {
  exportObj.translations = {};
}

exportObj.translations.English = {
  action: {
    "Barrel Roll": "Barrel Roll",
    "Boost": "Boost",
    "Evade": "Evade",
    "Focus": "Focus",
    "Target Lock": "Target Lock",
    "Recover": "Recover",
    "Reinforce": "Reinforce",
    "Jam": "Jam",
    "Coordinate": "Coordinate",
    "Cloak": "Cloak",
    "SLAM": "SLAM"
  },
  slot: {
    "Astromech": "Astromech",
    "Bomb": "Bomb",
    "Cannon": "Cannon",
    "Crew": "Crew",
    "Elite": "Elite",
    "Missile": "Missile",
    "System": "System",
    "Torpedo": "Torpedo",
    "Turret": "Turret",
    "Cargo": "Cargo",
    "Hardpoint": "Hardpoint",
    "Team": "Team",
    "Illicit": "Illicit",
    "Salvaged Astromech": "Salvaged Astromech"
  },
  sources: {
    "Core": "Core",
    "A-Wing Expansion Pack": "A-Wing Expansion Pack",
    "B-Wing Expansion Pack": "B-Wing Expansion Pack",
    "X-Wing Expansion Pack": "X-Wing Expansion Pack",
    "Y-Wing Expansion Pack": "Y-Wing Expansion Pack",
    "Millennium Falcon Expansion Pack": "Millennium Falcon Expansion Pack",
    "HWK-290 Expansion Pack": "HWK-290 Expansion Pack",
    "TIE Fighter Expansion Pack": "TIE Fighter Expansion Pack",
    "TIE Interceptor Expansion Pack": "TIE Interceptor Expansion Pack",
    "TIE Bomber Expansion Pack": "TIE Bomber Expansion Pack",
    "TIE Advanced Expansion Pack": "TIE Advanced Expansion Pack",
    "Lambda-Class Shuttle Expansion Pack": "Lambda-Class Shuttle Expansion Pack",
    "Slave I Expansion Pack": "Slave I Expansion Pack",
    "Imperial Aces Expansion Pack": "Imperial Aces Expansion Pack",
    "Rebel Transport Expansion Pack": "Rebel Transport Expansion Pack",
    "Z-95 Headhunter Expansion Pack": "Z-95 Headhunter Expansion Pack",
    "TIE Defender Expansion Pack": "TIE Defender Expansion Pack",
    "E-Wing Expansion Pack": "E-Wing Expansion Pack",
    "TIE Phantom Expansion Pack": "TIE Phantom Expansion Pack",
    "Tantive IV Expansion Pack": "Tantive IV Expansion Pack",
    "Rebel Aces Expansion Pack": "Rebel Aces Expansion Pack",
    "YT-2400 Freighter Expansion Pack": "YT-2400 Freighter Expansion Pack",
    "VT-49 Decimator Expansion Pack": "VT-49 Decimator Expansion Pack",
    "StarViper Expansion Pack": "StarViper Expansion Pack",
    "M3-A Interceptor Expansion Pack": "M3-A Interceptor Expansion Pack",
    "IG-2000 Expansion Pack": "IG-2000 Expansion Pack",
    "Most Wanted Expansion Pack": "Most Wanted Expansion Pack",
    "Imperial Raider Expansion Pack": "Imperial Raider Expansion Pack",
    "Hound's Tooth Expansion Pack": "Hound's Tooth Expansion Pack",
    "Kihraxz Fighter Expansion Pack": "Kihraxz Fighter Expansion Pack",
    "K-Wing Expansion Pack": "K-Wing Expansion Pack",
    "TIE Punisher Expansion Pack": "TIE Punisher Expansion Pack",
    "The Force Awakens Core Set": "The Force Awakens Core Set"
  },
  ui: {
    shipSelectorPlaceholder: "Select a ship",
    pilotSelectorPlaceholder: "Select a pilot",
    upgradePlaceholder: function(translator, language, slot) {
      return "No " + (translator(language, 'slot', slot)) + " Upgrade";
    },
    modificationPlaceholder: "No Modification",
    titlePlaceholder: "No Title",
    upgradeHeader: function(translator, language, slot) {
      return "" + (translator(language, 'slot', slot)) + " Upgrade";
    },
    unreleased: "unreleased",
    epic: "epic",
    limited: "limited"
  },
  byCSSSelector: {
    '.xwing-card-browser .translate.sort-cards-by': 'Sort cards by',
    '.xwing-card-browser option[value="name"]': 'Name',
    '.xwing-card-browser option[value="source"]': 'Source',
    '.xwing-card-browser option[value="type-by-points"]': 'Type (by Points)',
    '.xwing-card-browser option[value="type-by-name"]': 'Type (by Name)',
    '.xwing-card-browser .translate.select-a-card': 'Select a card from the list at the left.',
    '.info-well .info-ship td.info-header': 'Ship',
    '.info-well .info-skill td.info-header': 'Skill',
    '.info-well .info-actions td.info-header': 'Actions',
    '.info-well .info-upgrades td.info-header': 'Upgrades',
    '.info-well .info-range td.info-header': 'Range',
    '.clear-squad': 'New Squad',
    '.save-list': 'Save',
    '.save-list-as': 'Save as…',
    '.delete-list': 'Delete',
    '.backend-list-my-squads': 'Load squad',
    '.view-as-text': '<span class="hidden-phone"><i class="icon-print"></i>&nbsp;Print/View as </span>Text',
    '.randomize': 'Random!',
    '.randomize-options': 'Randomizer options…',
    '.notes-container > span': 'Squad Notes',
    '.bbcode-list': 'Copy the BBCode below and paste it into your forum post.<textarea></textarea><button class="btn btn-copy">Copy</button>',
    '.html-list': '<textarea></textarea><button class="btn btn-copy">Copy</button>',
    '.vertical-space-checkbox': "Add space for damage/upgrade cards when printing <input type=\"checkbox\" class=\"toggle-vertical-space\" />",
    '.color-print-checkbox': "Print color <input type=\"checkbox\" class=\"toggle-color-print\" />",
    '.print-list': '<i class="icon-print"></i>&nbsp;Print',
    '.do-randomize': 'Randomize!',
    '#empireTab': 'Galactic Empire',
    '#rebelTab': 'Rebel Alliance',
    '#scumTab': 'Scum and Villainy',
    '#browserTab': 'Card Browser',
    '#aboutTab': 'About'
  },
  singular: {
    'pilots': 'Pilot',
    'modifications': 'Modification',
    'titles': 'Title'
  },
  types: {
    'Pilot': 'Pilot',
    'Modification': 'Modification',
    'Title': 'Title'
  }
};

if (exportObj.cardLoaders == null) {
  exportObj.cardLoaders = {};
}

exportObj.cardLoaders.English = function() {
  var basic_cards, modification_translations, pilot_translations, title_translations, upgrade_translations;
  exportObj.cardLanguage = 'English';
  basic_cards = exportObj.basicCardData();
  exportObj.canonicalizeShipNames(basic_cards);
  exportObj.ships = basic_cards.ships;
  pilot_translations = {
    "Wedge Antilles": {
      text: "When attacking, reduce the defender's agility value by 1 (to a minimum of \"0\")."
    },
    "Garven Dreis": {
      text: "After spending a focus token, you may place that token on any other friendly ship at Range 1-2 (instead of discarding it)."
    },
    "Biggs Darklighter": {
      text: "Other friendly ships at Range 1 cannot be targeted by attacks if the attacker could target you instead."
    },
    "Luke Skywalker": {
      text: "When defending, you may change 1 of your %FOCUS% results to a %EVADE% result."
    },
    '"Dutch" Vander': {
      text: "After acquiring a target lock, choose another friendly ship at Range 1-2.  The chosen ship may immediately acquire a target lock."
    },
    "Horton Salm": {
      text: "When attacking at Range 2-3, you may reroll any of your blank results."
    },
    '"Winged Gundark"': {
      text: "When attacking at Range 1, you may change 1 of your %HIT% results to a %CRIT% result."
    },
    '"Night Beast"': {
      text: "After executing a green maneuver, you may perform a free focus action."
    },
    '"Backstabber"': {
      text: "When attacking from outside the defender's firing arc, roll 1 additional attack die."
    },
    '"Dark Curse"': {
      text: "When defending, ships attacking you cannot spend focus tokens or reroll attack dice."
    },
    '"Mauler Mithel"': {
      text: "When attacking at Range 1, roll 1 additional attack die."
    },
    '"Howlrunner"': {
      text: "When another friendly ship at Range 1 is attacking with its primary weapon, it may reroll 1 attack die."
    },
    "Maarek Stele": {
      text: "When your attack deals a faceup Damage card to the defender, instead draw 3 Damage cards, choose 1 to deal, and discard the others."
    },
    "Darth Vader": {
      text: "During your \"Perform Action\" step, you may perform 2 actions."
    },
    "\"Fel's Wrath\"": {
      text: "When the number of Damage cards assigned to you equals or exceeds your hull value, you are not destroyed until the end of the Combat phase."
    },
    "Turr Phennir": {
      text: "After you perform an attack, you may perform a free boost or barrel roll action."
    },
    "Soontir Fel": {
      text: "When you receive a stress token, you may assign 1 focus token to your ship."
    },
    "Tycho Celchu": {
      text: "You may perform actions even while you have stress tokens."
    },
    "Arvel Crynyd": {
      text: "You may declare an enemy ship inside your firing arc that you are touching as the target of your attack."
    },
    "Chewbacca": {
      text: "When you are dealt a faceup Damage card, immediately flip it facedown (without resolving its ability)."
    },
    "Lando Calrissian": {
      text: "After you execute a green maneuver, choose 1 other friendly ship at Range 1.  That ship may perform 1 free action shown on its action bar."
    },
    "Han Solo": {
      text: "When attacking, you may reroll all of your dice.  If you choose to do so, you must reroll as many of your dice as possible."
    },
    "Kath Scarlet": {
      text: "When attacking, the defender receives 1 stress token if he cancels at least 1 %CRIT% result."
    },
    "Boba Fett": {
      text: "When you reveal a bank maneuver (%BANKLEFT% or %BANKRIGHT%), you may rotate your dial to the other bank maneuver of the same speed."
    },
    "Krassis Trelix": {
      text: "When attacking with a secondary weapon, you may reroll 1 attack die."
    },
    "Ten Numb": {
      text: "When attacking, 1 of your %CRIT% results cannot be canceled by defense dice."
    },
    "Ibtisam": {
      text: "When attacking or defending, if you have at least 1 stress token, you may reroll 1 of your dice."
    },
    "Roark Garnet": {
      text: 'At the start of the Combat phase, choose 1 other friendly ship at Range 1-3.  Until the end of the phase, treat that ship\'s pilot skill value as "12."'
    },
    "Kyle Katarn": {
      text: "At the start of the Combat phase, you may assign 1 of your focus tokens to another friendly ship at Range 1-3."
    },
    "Jan Ors": {
      text: "When another friendly ship at Range 1-3 is attacking, if you have no stress tokens, you may receive 1 stress token to allow that ship to roll 1 additional attack die."
    },
    "Captain Jonus": {
      text: "When another friendly ship at Range 1 attacks with a secondary weapon, it may reroll up to 2 attack dice."
    },
    "Major Rhymer": {
      text: "When attacking with a secondary weapon, you may increase or decrease the weapon range by 1 to a limit of Range 1-3."
    },
    "Captain Kagi": {
      text: "When an enemy ship acquires a target lock, it must lock onto your ship if able."
    },
    "Colonel Jendon": {
      text: "At the start of the Combat phase, you may assign 1 of your blue target lock tokens to a friendly ship at Range 1 if it does not have a blue target lock token."
    },
    "Captain Yorr": {
      text: "When another friendly ship at Range 1-2 would receive a stress token, if you have 2 or fewer stress tokens, you may receive that token instead."
    },
    "Lieutenant Lorrir": {
      text: "When performing a barrel roll action, you may receive 1 stress token to use the (%BANKLEFT% 1) or (%BANKRIGHT% 1) template instead of the (%STRAIGHT% 1) template."
    },
    "Tetran Cowall": {
      text: "When you reveal a %UTURN% maneuver, you may treat the speed of that maneuver as \"1,\" \"3,\" or \"5\"."
    },
    "Kir Kanos": {
      text: "When attacking at Range 2-3, you may spend 1 evade token to add 1 %HIT% result to your roll."
    },
    "Carnor Jax": {
      text: "Enemy ships at Range 1 cannot perform focus or evade actions and cannot spend focus or evade tokens."
    },
    "Lieutenant Blount": {
      text: "When attacking, the defender is hit by your attack, even if he does not suffer any damage."
    },
    "Airen Cracken": {
      text: "After you perform an attack, you may choose another friendly ship at Range 1.  That ship may perform 1 free action."
    },
    "Colonel Vessery": {
      text: "When attacking, immediately after you roll attack dice, you may acquire a target lock on the defender if it already has a red target lock token."
    },
    "Rexler Brath": {
      text: "After you perform an attack that deals at least 1 Damage card to the defender, you may spend a focus token to flip those cards faceup."
    },
    "Etahn A'baht": {
      text: "When an enemy ship inside your firing arc at Range 1-3 is defending, the attacker may change 1 of its %HIT% results to a %CRIT% result."
    },
    "Corran Horn": {
      text: "At the start of the End phase, you may perform one attack.  You cannot attack during the next round."
    },
    '"Echo"': {
      text: "When you decloak, you must use the (%BANKLEFT% 2) or (%BANKRIGHT% 2) template instead of the (%STRAIGHT% 2) template."
    },
    '"Whisper"': {
      text: "After you perform an attack that hits, you may assign 1 focus to your ship."
    },
    "Wes Janson": {
      text: "After you perform an attack, you may remove 1 focus, evade, or blue target lock token from the defender."
    },
    "Jek Porkins": {
      text: "When you receive a stress token, you may remove it and roll 1 attack die.  On a %HIT% result, deal 1 facedown Damage card to this ship."
    },
    '"Hobbie" Klivian': {
      text: "When you acquire or spend a target lock, you may remove 1 stress token from your ship."
    },
    "Tarn Mison": {
      text: "When an enemy ship declares you as the target of an attack, you may acquire a target lock on that ship."
    },
    "Jake Farrell": {
      text: "After you perform a focus action or are assigned a focus token, you may perform a free boost or barrel roll action."
    },
    "Gemmer Sojan": {
      text: "While you are at Range 1 of at least 1 enemy ship, increase your agility value by 1."
    },
    "Keyan Farlander": {
      text: "When attacking, you may remove 1 stress token to change all of your %FOCUS% results to %HIT%results."
    },
    "Nera Dantels": {
      text: "You can perform %TORPEDO% secondary weapon attacks against enemy ships outside your firing arc."
    },
    "CR90 Corvette (Fore)": {
      text: "When attacking with your primary weapon, you may spend 1 energy to roll 1 additional attack die."
    },
    "Dash Rendar": {
      text: "You may ignore obstacles during the Activation phase and when performing actions."
    },
    '"Leebo"': {
      text: "When you are dealt a faceup Damage card, draw 1 additional Damage card, choose 1 to resolve, and discard the other."
    },
    "Eaden Vrill": {
      text: "When performing a primary weapon attack against a stressed ship, roll 1 additional attack die."
    },
    "Rear Admiral Chiraneau": {
      text: "When attacking at Range 1-2, you may change 1 of your %FOCUS% results to a %CRIT% result."
    },
    "Commander Kenkirk": {
      text: "If you have no shields and at least 1 Damage card assigned to you, increase your agility value by 1."
    },
    "Captain Oicunn": {
      text: "After executing a maneuver, each enemy ship you are touching suffers 1 damage."
    },
    "Prince Xizor": {
      text: "When defending, a friendly ship at Range 1 may suffer 1 uncanceled %HIT% or %CRIT% result instead of you."
    },
    "Guri": {
      text: "At the start of the Combat phase, if you are at Range 1 of an enemy ship, you may assign 1 focus token to your ship."
    },
    "Serissu": {
      text: "When another friendly ship at Range 1 is defending, it may reroll 1 defense die."
    },
    "Laetin A'shera": {
      text: "After you defend against an attack, if the attack did not hit, you may assign 1 evade token to your ship."
    },
    "IG-88A": {
      text: "After you perform an attack that destroys the defender, you may recover 1 shield."
    },
    "IG-88B": {
      text: "Once per round, after you perform an attack that does not hit, you may perform an attack with an equipped %CANNON% secondary weapon."
    },
    "IG-88C": {
      text: "After you perform a boost action, you may perform a free evade action."
    },
    "IG-88D": {
      text: "You may execute the (%SLOOPLEFT% 3) or (%SLOOPRIGHT% 3) maneuver using the corresponding (%TURNLEFT% 3) or (%TURNRIGHT% 3) template."
    },
    "Boba Fett (Scum)": {
      text: "When attacking or defending, you may reroll 1 of your dice for each enemy ship at Range 1."
    },
    "Kath Scarlet (Scum)": {
      text: "When attacking a ship inside your auxiliary firing arc, roll 1 additional attack die."
    },
    "Emon Azzameen": {
      text: "When dropping a bomb, you may use the [%TURNLEFT% 3], [%STRAIGHT% 3], or [%TURNRIGHT% 3] template instead of the [%STRAIGHT% 1] template."
    },
    "Kavil": {
      text: "When attacking a ship outside your firing arc, roll 1 additional attack die."
    },
    "Drea Renthal": {
      text: "After you spend a target lock, you may receive 1 stress token to acquire a target lock."
    },
    "Dace Bonearm": {
      text: "When an enemy ship at Range 1-3 receives at least 1 ion token, if you are not stressed, you may receive 1 stress token to cause that ship to suffer 1 damage."
    },
    "Palob Godalhi": {
      text: "At the start of the Combat phase, you may remove 1 focus or evade token from an enemy ship at Range 1-2 and assign it to yourself."
    },
    "Torkil Mux": {
      text: "At the end of the Activation phase, choose 1 enemy ship at Range 1-2. Until the end of the Combat phase, treat that ship's pilot skill value as \"0\"."
    },
    "N'Dru Suhlak": {
      text: "When attacking, if there are no other friendly ships at Range 1-2, roll 1 additional attack die."
    },
    "Kaa'To Leeachos": {
      text: "At the start of the Combat phase, you may remove 1 focus or evade token from another friendly ship at Range 1-2 and assign it to yourself."
    },
    "Commander Alozen": {
      text: "At the start of the Combat phase, you may acquire a target lock on an enemy ship at Range 1."
    },
    "Raider-class Corvette (Fore)": {
      text: "Once per round, after you perform a primary weapon attack, you may spend 2 energy to perform another primary weapon attack."
    },
    "Bossk": {
      text: "When you perform an attack that hits, before dealing damage, you may cancel 1 of your %CRIT% results to add 2 %HIT% results."
    },
    "Talonbane Cobra": {
      text: "When attacking or defending, double the effect of your range combat bonuses."
    },
    "Miranda Doni": {
      text: "Once per round when attacking, you may either spend 1 shield to roll 1 additional attack die <strong>or</strong> roll 1 fewer attack die to recover 1 shield."
    },
    '"Redline"': {
      text: "You may maintain 2 target locks on the same ship.  When you acquire a target lock, you may acquire a second lock on that ship."
    },
    '"Deathrain"': {
      text: "When dropping a bomb, you may use the front guides of your ship.  After dropping a bomb, you may perform a free barrel roll action."
    },
    "Juno Eclipse": {
      text: "When you reveal your maneuver, you may increase or decrease its speed by 1 (to a minimum of 1)."
    },
    "Zertik Strom": {
      text: "Enemy ships at Range 1 cannot add their range combat bonus when attacking."
    },
    "Lieutenant Colzet": {
      text: "At the start of the End phase, you may spend a target lock you have on an enemy ship to flip 1 random facedown Damage card assigned to it faceup."
    },
    "Latts Razzi": {
      text: "When a friendly ship declares an attack, you may spend a target lock you have on the defender to reduce its agility by 1 for that attack."
    },
    "Graz the Hunter": {
      text: "When defending, if the attacker is inside your firing arc, roll 1 additional defense die."
    },
    "Esege Tuketu": {
      text: "When another friendly ship at Range 1-2 is attacking, it may treat your focus tokens as its own."
    },
    "Moralo Eval": {
      text: "You can perform %CANNON% secondary attacks against ships inside your auxiliary firing arc."
    },
    'Gozanti-class Cruiser': {
      text: "After you execute a maneuver, you may deploy up to 2 attached ships."
    },
    '"Scourge"': {
      text: "When attacking a defender that has 1 or more Damage cards, roll 1 additional attack die."
    },
    "The Inquisitor": {
      text: "When attacking with your primary weapon at Range 2-3, treat the range of the attack as Range 1."
    },
    "Zuckuss": {
      text: "When attacking, you may roll 1 additional attack die.  If you do, the defender rolls 1 additional defense die."
    },
    "Dengar": {
      text: "Once per round after defending, if the attacker is inside your firing arc, you may perform an attack against that ship."
    },
    "Poe Dameron": {
      text: "When attacking or defending, if you have a focus token, you may change 1 of your %FOCUS% results to a %HIT% or %EVADE% result."
    },
    '"Blue Ace"': {
      text: "When performing a boost action, you may use the (%TURNLEFT% 1) or (%TURNRIGHT% 1) template."
    },
    '"Omega Ace"': {
      text: "When attacking, you may spend a focus token and a target lock you have on the defender to change all of your results to %CRIT% results."
    },
    '"Epsilon Leader"': {
      text: "At the start of the Combat phase, remove 1 stress token from each friendly ship at Range 1."
    },
    '"Zeta Ace"': {
      text: "When performing a barrel roll you may use the (%STRAIGHT% 2) template instead of the (%STRAIGHT% 1) template."
    },
    '"Red Ace"': {
      text: 'The first time you remove a shield token from your ship each round, assign 1 evade token to your ship.'
    },
    '"Omega Leader"': {
      text: 'Enemy ships that you have locked cannot modify any dice when attacking you or defending against your attacks.'
    },
    'Hera Syndulla': {
      text: 'When you reveal a green or red maneuver, you may rotate your dial to another maneuver of the same difficulty.'
    },
    '"Youngster"': {
      text: "Friendly TIE fighters at Range 1-3 may perform the action on your equipped %ELITE% Upgrade card."
    },
    '"Wampa"': {
      text: "When attacking, you may cancel all die results.  If you cancel a %CRIT% result, deal 1 facedown Damage card to the defender."
    },
    '"Chaser"': {
      text: "When another friendly ship at Range 1 spends a focus token, assign a focus token to your ship."
    },
    'Ezra Bridger': {
      text: "When defending, if you are stressed, you may change up to 2 of your %FOCUS% results to %EVADE% results."
    },
    '"Zeta Leader"': {
      text: 'When attacking, if you are not stressed, you may receive 1 stress token to roll 1 additional die.'
    },
    '"Epsilon Ace"': {
      text: 'While you do not have any Damage cards, treat your pilot skill value as "12."'
    },
    "Kanan Jarrus": {
      text: "When an enemy ship at Range 1-2 is attacking, you may spend a focus token.  If you do, the attacker rolls 1 fewer attack die."
    },
    '"Chopper"': {
      text: "At the start of the Combat phase, each enemy ship you are touching receives 1 stress token."
    },
    'Hera Syndulla (Attack Shuttle)': {
      text: "When you reveal a green or red maneuver, you may rotate your dial to another maneuver of the same difficulty."
    },
    'Sabine Wren': {
      text: "Immediately before you reveal your maneuver, you may perform a free boost or barrel roll action."
    },
    '"Zeb" Orrelios': {
      text: 'When defending, you may cancel %CRIT% results before %HIT% results.'
    },
    'Tomax Bren': {
      text: 'Once per round, after you discard an %ELITE% Upgrade card, flip that card faceup.'
    },
    'Ello Asty': {
      text: 'While you are not stressed, you may treat your %TROLLLEFT% and %TROLLRIGHT% maneuvers as white maneuvers.'
    },
    "Valen Rudor": {
      text: "After defending, you may perform a free action."
    },
    "4-LOM": {
      text: "At the start of the End phase, you may assign 1 of your stress tokens to another ship at Range 1."
    },
    "Tel Trevura": {
      text: "The first time you would be destroyed, instead cancel any remaining damage, discard all Damage cards, and deal 4 facedown Damage cards to this ship."
    },
    "Manaroo": {
      text: "At the start of the Combat phase, you may assign all focus, evade, and target lock tokens assigned to you to another friendly ship."
    }
  };
  upgrade_translations = {
    "Ion Cannon Turret": {
      text: "<strong>Attack:</strong> Attack 1 ship (even a ship outside your firing arc).%LINEBREAK%If this attack hits the target ship, the ship suffers 1 damage and receives 1 ion token.  Then cancel all dice results."
    },
    "Proton Torpedoes": {
      text: "<strong>Attack (target lock):</strong> Spend your target lock and discard this card to perform this attack.%LINEBREAK%You may change 1 of your %FOCUS% results to a %CRIT% result."
    },
    "R2 Astromech": {
      text: "You may treat all 1- and 2-speed maneuvers as green maneuvers."
    },
    "R2-D2": {
      text: "After executing a green maneuver, you may recover 1 shield (up to your shield value)."
    },
    "R2-F2": {
      text: "<strong>Action:</strong> Increase your agility value by 1 until the end of this game round."
    },
    "R5-D8": {
      text: "<strong>Action:</strong> Roll 1 defense die.%LINEBREAK%On a %EVADE% or %FOCUS% result, discard 1 of your facedown Damage cards."
    },
    "R5-K6": {
      text: "After spending your target lock, roll 1 defense die.%LINEBREAK%On a %EVADE% result, immediately acquire a target lock on that same ship.  You cannot spend this target lock during this attack."
    },
    "R5 Astromech": {
      text: "During the End phase, you may choose 1 of your faceup Damage cards with the Ship trait and flip it facedown."
    },
    "Determination": {
      text: "When you are dealt a faceup Damage card with the Pilot trait, discard it immediately without resolving its effect."
    },
    "Swarm Tactics": {
      text: "At the start of the Combat phase, you may choose 1 friendly ship at Range 1.%LINEBREAK%Until the end of this phase, treat the chosen ship as if its pilot skill were equal to your pilot skill."
    },
    "Squad Leader": {
      text: "<strong>Action:</strong> Choose 1 ship at Range 1-2 that has a lower pilot skill than you.%LINEBREAK%The chosen ship may immediately perform 1 free action."
    },
    "Expert Handling": {
      text: "<strong>Action:</strong> Perform a free barrel roll action.  If you do not have the %BARRELROLL% action icon, receive 1 stress token.%LINEBREAK%You may then remove 1 enemy target lock from your ship."
    },
    "Marksmanship": {
      text: "<strong>Action:</strong> When attacking this round, you may change 1 of your %FOCUS% results to a %CRIT% result and all of your other %FOCUS% results to %HIT% results."
    },
    "Concussion Missiles": {
      text: "<strong>Attack (target lock):</strong>  Spend your target lock and discard this card to perform this attack.%LINEBREAK%You may change 1 of your blank results to a %HIT% result."
    },
    "Cluster Missiles": {
      text: "<strong>Attack (target lock):</strong> Spend your target lock and discard this card to perform this attack twice."
    },
    "Daredevil": {
      text: "<strong>Action:</strong> Execute a white (%TURNLEFT% 1) or (%TURNRIGHT% 1) maneuver.  Then, receive 1 stress token.%LINEBREAK%Then, if you do not have the %BOOST% action icon, roll 2 attack dice.  Suffer any damage (%HIT%) and any critical damage (%CRIT%) rolled."
    },
    "Elusiveness": {
      text: "When defending, you may receive 1 stress token to choose 1 attack die.  The attacker must reroll that die.%LINEBREAK%If you have at least 1 stress token, you cannot use this ability."
    },
    "Homing Missiles": {
      text: "<strong>Attack (target lock):</strong> Discard this card to perform this attack.%LINEBREAK%The defender cannot spend evade tokens during this attack."
    },
    "Push the Limit": {
      text: "Once per round, after you perform an action, you may perform 1 free action shown in your action bar.%LINEBREAK%Then receive 1 stress token."
    },
    "Deadeye": {
      text: "You may treat the <strong>Attack (target lock):</strong> header as <strong>Attack (focus):</strong>.%LINEBREAK%When an attack instructs you to spend a target lock, you may spend a focus token instead."
    },
    "Expose": {
      text: "<strong>Action:</strong> Until the end of the round, increase your primary weapon value by 1 and decrease your agility value by 1."
    },
    "Gunner": {
      text: "After you perform an attack that does not hit, you may immediately perform a primary weapon attack.  You cannot perform another attack this round."
    },
    "Ion Cannon": {
      text: "<strong>Attack:</strong> Attack 1 ship.%LINEBREAK%If this attack hits, the defender suffers 1 damage and receives 1 ion token.  Then cancel all dice results."
    },
    "Heavy Laser Cannon": {
      text: "<strong>Attack:</strong> Attack 1 ship.%LINEBREAK%Immediately after rolling your attack dice, you must change all of your %CRIT% results to %HIT% results."
    },
    "Seismic Charges": {
      text: "When you reveal your maneuver dial, you may discard this card to drop 1 seismic charge token.%LINEBREAK%This token detonates at the end of the Activation phase.%LINEBREAK%<strong>Seismic Charge Token:</strong> When this bomb token detonates, each ship at Range 1 of the token suffers 1 damage.  Then discard this token."
    },
    "Mercenary Copilot": {
      text: "When attacking at Range 3, you may change 1 of your %HIT% results to a %CRIT% result."
    },
    "Assault Missiles": {
      text: "<strong>Attack (target lock):</strong> Spend your target lock and discard this card to perform this attack.%LINEBREAK%If this attack hits, each other ship at Range 1 of the defender suffers 1 damage."
    },
    "Veteran Instincts": {
      text: "Increase your pilot skill value by 2."
    },
    "Proximity Mines": {
      text: "<strong>Action:</strong> Discard this card to <strong>drop</strong> 1 proximity mine token.%LINEBREAK%When a ship's base or maneuver template overlaps this token, this token <strong>detonates</strong>.%LINEBREAK%<strong>Proximity Mine Token:</strong> When this bomb token detonates, the ship that moved through or overlapped this token rolls 3 attack dice and suffers all damage (%HIT%) and critical damage (%CRIT%) rolled.  Then discard this token."
    },
    "Weapons Engineer": {
      text: "You may maintain 2 target locks (only 1 per enemy ship).%LINEBREAK%When you acquire a target lock, you may lock onto 2 different ships."
    },
    "Draw Their Fire": {
      text: "When a friendly ship at Range 1 is hit by an attack, you may suffer 1 of the uncanceled %CRIT% results instead of the target ship."
    },
    "Luke Skywalker": {
      text: "%REBELONLY%%LINEBREAK%After you perform an attack that does not hit, you may immediately perform a primary weapon attack.  You may change 1 %FOCUS% result to a %HIT% result.  You cannot perform another attack this round."
    },
    "Nien Nunb": {
      text: "%REBELONLY%%LINEBREAK%You may treat all %STRAIGHT% maneuvers as green maneuvers."
    },
    "Chewbacca": {
      text: "%REBELONLY%%LINEBREAK%When you are dealt a Damage card, you may immediately discard that card and recover 1 shield.%LINEBREAK%Then, discard this Upgrade card."
    },
    "Advanced Proton Torpedoes": {
      text: "<strong>Attack (target lock):</strong> Spend your target lock and discard this card to perform this attack.%LINEBREAK%You may change up to 3 of your blank results to %FOCUS% results."
    },
    "Autoblaster": {
      text: "<strong>Attack:</strong> Attack 1 ship.%LINEBREAK%Your %HIT% results cannot be canceled by defense dice.%LINEBREAK%The defender may cancel %CRIT% results before %HIT% results."
    },
    "Fire-Control System": {
      text: "After you perform an attack, you may acquire a target lock on the defender."
    },
    "Blaster Turret": {
      text: "<strong>Attack (focus):</strong> Spend 1 focus token to perform this attack against 1 ship (even a ship outside your firing arc)."
    },
    "Recon Specialist": {
      text: "When you perform a focus action, assign 1 additional focus token to your ship."
    },
    "Saboteur": {
      text: "<strong>Action:</strong> Choose 1 enemy ship at Range 1 and roll 1 attack die.  On a %HIT% or %CRIT% result, choose 1 random facedown Damage card assigned to that ship, flip it faceup, and resolve it."
    },
    "Intelligence Agent": {
      text: "At the start of the Activation phase, choose 1 enemy ship at Range 1-2.  You may look at that ship's chosen maneuver."
    },
    "Proton Bombs": {
      text: "When you reveal your maneuver dial, you may discard this card to <strong>drop</strong> 1 proton bomb token.%LINEBREAK%This token <strong>detonates</strong> at the end of the Activation phase.%LINEBREAK%<strong>Proton Bomb Token:</strong> When this bomb token detonates, deal 1 <strong>faceup</strong> Damage card to each ship at Range 1 of the token.  Then discard this token."
    },
    "Adrenaline Rush": {
      text: "When you reveal a red maneuver, you may discard this card to treat that maneuver as a white maneuver until the end of the Activation phase."
    },
    "Advanced Sensors": {
      text: "Immediately before you reveal your maneuver, you may perform 1 free action.%LINEBREAK%If you use this ability, you must skip your \"Perform Action\" step during this round."
    },
    "Sensor Jammer": {
      text: "When defending, you may change 1 of the attacker's %HIT% results into a %FOCUS% result.%LINEBREAK%The attacker cannot reroll the die with the changed result."
    },
    "Darth Vader": {
      text: "%IMPERIALONLY%%LINEBREAK%After you perform an attack against an enemy ship, you may suffer 2 damage to cause that ship to suffer 1 critical damage."
    },
    "Rebel Captive": {
      text: "%IMPERIALONLY%%LINEBREAK%Once per round, the first ship that declares you as the target of an attack immediately receives 1 stress token."
    },
    "Flight Instructor": {
      text: "When defending, you may reroll 1 of your %FOCUS% results.  If the attacker's pilot skill value is \"2\" or lower, you may reroll 1 of your blank results instead."
    },
    "Navigator": {
      text: "When you reveal a maneuver, you may rotate your dial to another maneuver with the same bearing.%LINEBREAK%You cannot rotate to a red maneuver if you have any stress tokens."
    },
    "Opportunist": {
      text: "When attacking, if the defender does not have any focus or evade tokens, you may receive 1 stress token to roll 1 additional attack die.%LINEBREAK%You cannot use this ability if you have any stress tokens."
    },
    "Comms Booster": {
      text: "<strong>Energy:</strong> Spend 1 energy to remove all stress tokens from a friendly ship at Range 1-3.  Then assign 1 focus token to that ship."
    },
    "Slicer Tools": {
      text: "<strong>Action:</strong> Choose 1 or more ships at Range 1-3 that have a stress token.  For each ship chosen, you may spend 1 energy to cause that ship to suffer 1 damage."
    },
    "Shield Projector": {
      text: "When an enemy ship is declaring either a small or large ship as the target of its attack, you may spend 3 energy to force that ship to target you if possible."
    },
    "Ion Pulse Missiles": {
      text: "<strong>Attack (target lock):</strong> Discard this card to perform this attack.%LINEBREAK%If this attack hits, the defender suffers 1 damage and receives 2 ion tokens.  Then cancel <strong>all</strong> dice results."
    },
    "Wingman": {
      text: "At the start of the Combat phase, remove 1 stress token from another friendly ship at Range 1."
    },
    "Decoy": {
      text: "At the start of the Combat phase, you may choose 1 friendly ship at Range 1-2.  Exchange your pilot skill with that ship's pilot skill until the end of the phase."
    },
    "Outmaneuver": {
      text: "When attacking a ship inside your firing arc, if you are not inside that ship's firing arc, reduce its agility value by 1 (to a minimum of 0)."
    },
    "Predator": {
      text: "When attacking, you may reroll 1 attack die.  If the defender's pilot skill value is \"2\" or lower, you may instead reroll up to 2 attack dice."
    },
    "Flechette Torpedoes": {
      text: "<strong>Attack (target lock):</strong> Discard this card and spend your target lock to perform this attack.%LINEBREAK%After you perform this attack, the defender receives 1 stress token if its hull value is \"4\" or lower."
    },
    "R7 Astromech": {
      text: "Once per round when defending, if you have a target lock on the attacker, you may spend the target lock to choose any or all attack dice.  The attacker must reroll the chosen dice."
    },
    "R7-T1": {
      text: "<strong>Action:</strong> Choose an enemy ship at Range 1-2.  If you are inside that ship's firing arc, you may acquire a target lock on that ship.  Then, you may perform a free boost action."
    },
    "Tactician": {
      text: "After you perform an attack against a ship inside your firing arc at Range 2, that ship receives 1 stress token."
    },
    "R2-D2 (Crew)": {
      text: "%REBELONLY%%LINEBREAK%At the end of the End phase, if you have no shields, you may recover 1 shield and roll 1 attack die.  On a %HIT% result, randomly flip 1 of your facedown Damage cards faceup and resolve it."
    },
    "C-3PO": {
      text: "%REBELONLY%%LINEBREAK%Once per round, before you roll 1 or more defense dice, you may guess aloud a number of %EVADE% results.  If you roll that many %EVADE% results (before modifying dice), add 1 %EVADE% result."
    },
    "Single Turbolasers": {
      text: "<strong>Attack (Energy):</strong> Spend 2 energy from this card to perform this attack.  The defender doubles his agility value against this attack.  You may change 1 of your %FOCUS% results to a %HIT% result."
    },
    "Quad Laser Cannons": {
      text: "<strong>Attack (Energy):</strong> Spend 1 energy from this card to perform this attack.  If this attack does not hit, you may immediately spend 1 energy from this card to perform this attack again."
    },
    "Tibanna Gas Supplies": {
      text: "<strong>Energy:</strong> You may discard this card to gain 3 energy."
    },
    "Ionization Reactor": {
      text: "<strong>Energy:</strong> Spend 5 energy from this card and discard this card to cause each other ship at Range 1 to suffer 1 damage and receive 1 ion token."
    },
    "Engine Booster": {
      text: "Immediately before you reveal your maneuver dial, you may spend 1 energy to execute a white (%STRAIGHT% 1) maneuver.  You cannot use this ability if you would overlap another ship."
    },
    "R3-A2": {
      text: "When you declare the target of your attack, if the defender is inside your firing arc, you may receive 1 stress token to cause the defender to receive 1 stress token."
    },
    "R2-D6": {
      text: "Your upgrade bar gains the %ELITE% upgrade icon.%LINEBREAK%You cannot equip this upgrade if you already have a %ELITE% upgrade icon or if your pilot skill value is \"2\" or lower."
    },
    "Enhanced Scopes": {
      text: "During the Activation phase, treat your pilot skill value as \"0\"."
    },
    "Chardaan Refit": {
      text: "<span class=\"card-restriction\">A-Wing only.</span>%LINEBREAK%This card has a negative squad point cost."
    },
    "Proton Rockets": {
      text: "<strong>Attack (Focus):</strong> Discard this card to perform this attack.%LINEBREAK%You may roll additional attack dice equal to your agility value, to a maximum of 3 additional dice."
    },
    "Kyle Katarn": {
      text: "%REBELONLY%%LINEBREAK%After you remove a stress token from your ship, you may assign a focus token to your ship."
    },
    "Jan Ors": {
      text: "%REBELONLY%%LINEBREAK%Once per round, when a friendly ship at Range 1-3 performs a focus action or would be assigned a focus token, you may assign it an evade token instead."
    },
    "Toryn Farr": {
      text: "%HUGESHIPONLY% %REBELONLY%%LINEBREAK%<strong>Action:</strong> Spend any amount of energy to choose that many enemy ships at Range 1-2.  Remove all focus, evade, and blue target lock tokens from those ships."
    },
    "R4-D6": {
      text: "When you are hit by an attack and there are at least 3 uncanceled %HIT% results, you may choose to cancel those results until there are 2 remaining.  For each result canceled this way, receive 1 stress token."
    },
    "R5-P9": {
      text: "At the end of the Combat phase, you may spend 1 of your focus tokens to recover 1 shield (up to your shield value)."
    },
    "WED-15 Repair Droid": {
      text: "%HUGESHIPONLY%%LINEBREAK%<strong>Action:</strong> Spend 1 energy to discard 1 of your facedown Damage cards, or spend 3 energy to discard 1 of your faceup Damage cards."
    },
    "Carlist Rieekan": {
      text: "%HUGESHIPONLY% %REBELONLY%%LINEBREAK%At the start of the Activation phase, you may discard this card to treat each friendly ship's pilot skill value as \"12\" until the end of the phase."
    },
    "Jan Dodonna": {
      text: "%HUGESHIPONLY% %REBELONLY%%LINEBREAK%When another friendly ship at Range 1 is attacking, it may change 1 of its %HIT% results to a %CRIT%."
    },
    "Expanded Cargo Hold": {
      text: "<span class=\"card-restriction\">GR-75 only.</span>%LINEBREAK%Once per round, when you would be dealt a faceup Damage card, you may draw that card from either the fore or aft Damage deck."
    },
    "Backup Shield Generator": {
      text: "At the end of each round, you may spend 1 energy to recover 1 shield (up to your shield value)."
    },
    "EM Emitter": {
      text: "When you obstruct an attack, the defender rolls 3 additional defense dice (instead of 1)."
    },
    "Frequency Jammer": {
      text: "When you perform a jam action, choose 1 enemy ship that does not have a stress token and is at Range 1 of the jammed ship.  The chosen ship receives 1 stress token."
    },
    "Han Solo": {
      text: "%REBELONLY%%LINEBREAK%When attacking, if you have a target lock on the defender, you may spend that target lock to change all of your %FOCUS% results to %HIT% results."
    },
    "Leia Organa": {
      text: "%REBELONLY%%LINEBREAK%At the start of the Activation phase, you may discard this card to allow all friendly ships that reveal a red maneuver to treat that maneuver as a white maneuver until the end of the phase."
    },
    "Targeting Coordinator": {
      text: "<strong>Energy:</strong> You may spend 1 energy to choose 1 friendly ship at Range 1-2.  Acquire a target lock, then assign the blue target lock token to the chosen ship."
    },
    "Raymus Antilles": {
      text: "%HUGESHIPONLY% %REBELONLY%%LINEBREAK%At the start of the Activation phase, choose 1 enemy ship at Range 1-3.  You may look at that ship's chosen maneuver.  If the maneuver is white, assign that ship 1 stress token."
    },
    "Gunnery Team": {
      text: "Once per round, when attacking with a secondary weapon, you may spend 1 energy to change 1 of your blank results to a %HIT% result."
    },
    "Sensor Team": {
      text: "When acquiring a target lock, you may lock onto an enemy ship at Range 1-5 instead of 1-3."
    },
    "Engineering Team": {
      text: "During the Activation phase, when you reveal a %STRAIGHT% maneuver, gain 1 additional energy during the \"Gain Energy\" step."
    },
    "Lando Calrissian": {
      text: "%REBELONLY%%LINEBREAK%<strong>Action:</strong> Roll 2 defense dice.  For each %FOCUS% result, assign 1 focus token to your ship.  For each %EVADE% result, assign 1 evade token to your ship."
    },
    "Mara Jade": {
      text: "%IMPERIALONLY%%LINEBREAK%At the end of the Combat phase, each enemy ship at Range 1 that does not have a stress token receives 1 stress token."
    },
    "Fleet Officer": {
      text: "%IMPERIALONLY%%LINEBREAK%<strong>Action:</strong> Choose up to 2 friendly ships at Range 1-2 and assign 1 focus token to each of those ships.  Then receive 1 stress token."
    },
    "Lone Wolf": {
      text: "When attacking or defending, if there are no other friendly ships at Range 1-2, you may reroll 1 of your blank results."
    },
    "Stay On Target": {
      text: "When you reveal a maneuver, you may rotate your dial to another maneuver with the same speed.%LINEBREAK%Treat that maneuver as a red maneuver."
    },
    "Dash Rendar": {
      text: "%REBELONLY%%LINEBREAK%You may perform attacks while overlapping an obstacle.%LINEBREAK%Your attacks cannot be obstructed."
    },
    '"Leebo"': {
      text: "%REBELONLY%%LINEBREAK%<strong>Action:</strong> Perform a free boost action.  Then receive 1 ion token."
    },
    "Ruthlessness": {
      text: "%IMPERIALONLY%%LINEBREAK%After you perform an attack that hits, you <strong>must</strong> choose 1 other ship at Range 1 of the defender (other than yourself).  That ship suffers 1 damage."
    },
    "Intimidation": {
      text: "While you are touching an enemy ship, reduce that ship's agility value by 1."
    },
    "Ysanne Isard": {
      text: "%IMPERIALONLY%%LINEBREAK%At the start of the Combat phase, if you have no shields and at least 1 Damage card assigned to your ship, you may perform a free evade action."
    },
    "Moff Jerjerrod": {
      text: "%IMPERIALONLY%%LINEBREAK%When you are dealt a faceup Damage card, you may discard this Upgrade card or another %CREW% Upgrade card to flip that Damage card facedown (without resolving its effect)."
    },
    "Ion Torpedoes": {
      text: "<strong>Attack (target lock):</strong> Spend your target lock and discard this card to perform this attack.%LINEBREAK%If this attack hits, the defender and each ship at Range 1 of it receives 1 ion token."
    },
    "Bodyguard": {
      text: "%SCUMONLY%%LINEBREAK%At the start of the Combat phase, you may spend a focus token to choose a friendly ship at Range 1 with higher pilot skill than you. Increase its agility value by 1 until the end of the round."
    },
    "Calculation": {
      text: "When attacking, you may spend a focus token to change 1 of your %FOCUS% results to a %CRIT% result."
    },
    "Accuracy Corrector": {
      text: "When attacking, during the \"Modify Attack Dice\" step, you may cancel all of your dice results. Then, you may add 2 %HIT% results to your roll.%LINEBREAK%Your dice cannot be modified again during this attack."
    },
    "Inertial Dampeners": {
      text: "When you reveal your maneuver, you may discard this card to instead perform a white [0%STOP%] maneuver. Then receive 1 stress token."
    },
    "Flechette Cannon": {
      text: "<strong>Attack:</strong> Attack 1 ship.%LINEBREAK%If this attack hits, the defender suffers 1 damage and, if the defender is not stressed, it also receives 1 stress token.  Then cancel <strong>all</strong> dice results."
    },
    '"Mangler" Cannon': {
      text: "<strong>Attack:</strong> Attack 1 ship.%LINEBREAK%When attacking, you may change 1 of your %HIT% results to a %CRIT% result."
    },
    "Dead Man's Switch": {
      text: "When you are destroyed, each ship at Range 1 suffers 1 damage."
    },
    "Feedback Array": {
      text: "During the Combat phase, instead of performing any attacks, you may receive 1 ion token and suffer 1 damage to choose 1 enemy ship at Range 1.  That ship suffers 1 damage."
    },
    '"Hot Shot" Blaster': {
      text: "<strong>Attack:</strong> Discard this card to attack 1 ship (even a ship outside your firing arc)."
    },
    "Greedo": {
      text: "%SCUMONLY%%LINEBREAK%The first time you attack each round and the first time you defend each round, the first Damage card dealt is dealt faceup."
    },
    "Salvaged Astromech": {
      text: "When you are dealt a faceup Damage card with the <strong>Ship</strong> trait, you may immediately discard that card (before resolving its effect).%LINEBREAK%Then, discard this Upgrade card."
    },
    "Bomb Loadout": {
      text: "<span class=\"card-restriction\">Y-Wing only.</span>%LINEBREAK%Your upgrade bar gains the %BOMB% icon."
    },
    '"Genius"': {
      text: "If you are equipped with a bomb that can be dropped when you reveal your maneuver, you may drop the bomb <strong>after</strong> you execute your maneuver instead."
    },
    "Unhinged Astromech": {
      text: "You may treat all 3-speed maneuvers as green maneuvers."
    },
    "R4-B11": {
      text: "When attacking, if you have a target lock on the defender, you may spend the target lock to choose any or all defense dice. The defender must reroll the chosen dice."
    },
    "Autoblaster Turret": {
      text: "<strong>Attack:</strong> Attack 1 ship (even a ship outside your firing arc).%LINEBREAK%Your %HIT% results cannot be canceled by defense dice. The defender may cancel %CRIT% results before %HIT% results."
    },
    "R4 Agromech": {
      text: "When attacking, after you spend a focus token, you may acquire a target lock on the defender."
    },
    "K4 Security Droid": {
      text: "%SCUMONLY%%LINEBREAK%After executing a green maneuver, you may acquire a target lock."
    },
    "Outlaw Tech": {
      text: "%SCUMONLY%%LINEBREAK%After you execute a red maneuver, you may assign 1 focus token to your ship."
    },
    "Advanced Targeting Computer": {
      text: "<span class=\"card-restriction\">TIE Advanced only.</span>%LINEBREAK%When attacking with your primary weapon, if you have a target lock on the defender, you may add 1 %CRIT% result to your roll.  If you do, you cannot spend target locks during this attack."
    },
    "Ion Cannon Battery": {
      text: "<strong>Attack (energy):</strong> Spend 2 energy from this card to perform this attack.  If this attack hits, the defender suffers 1 critical damage and receives 1 ion token.  Then cancel <strong>all</strong> dice results."
    },
    "Extra Munitions": {
      text: "When you equip this card, place 1 ordnance token on each equipped %TORPEDO%, %MISSILE%, and %BOMB% Upgrade card.  When you are instructed to discard an Upgrade card, you may discard 1 ordnance token on that card instead."
    },
    "Cluster Mines": {
      text: "<strong>Action:</strong> Discard this card to <strong>drop</strong> 3 cluster mine tokens.<br /><br />When a ship's base or maneuver template overlaps a cluster mine token, that token <strong>detonates</strong>.<br /><br /><strong>Cluster Mines Tokens:</strong> When one of these bomb tokens detonates, the ship that moved through or overlapped this token rolls 2 attack dice and suffers all damage (%HIT%) rolled.  Then discard this token."
    },
    "Glitterstim": {
      text: "At the start of the Combat phase, you may discard this card and receive 1 stress token.  If you do, until the end of the round, when attacking  or defending, you may change all of your %FOCUS% results to %HIT% or %EVADE% results."
    },
    "Grand Moff Tarkin": {
      text: "%HUGESHIPONLY% %IMPERIALONLY%%LINEBREAK%At the start of the Combat phase, you may choose another ship at Range 1-4.  Either remove 1 focus token from the chosen ship or assign 1 focus token to that ship."
    },
    "Captain Needa": {
      text: "%HUGESHIPONLY% %IMPERIALONLY%%LINEBREAK%If you overlap an obstacle during the Activation phase, do not suffer 1 faceup damage card.  Instead, roll 1 attack die.  On a %HIT% or %CRIT% result, suffer 1 damage."
    },
    "Admiral Ozzel": {
      text: "%HUGESHIPONLY% %IMPERIALONLY%%LINEBREAK%<strong>Energy:</strong> You may remove up to 3 shields from your ship.  For each shield removed, gain 1 energy."
    },
    "Emperor Palpatine": {
      text: "%IMPERIALONLY%%LINEBREAK%Once per round, you may change a friendly ship's die result to any other die result.  That die result cannot be modified again."
    },
    "Bossk": {
      text: "%SCUMONLY%%LINEBREAK%After you perform an attack that does not hit, if you are not stressed, you <strong>must</strong> receive 1 stress token. Then assign 1 focus token to your ship and acquire a target lock on the defender."
    },
    "Lightning Reflexes": {
      text: "%SMALLSHIPONLY%%LINEBREAK%After you execute a white or green maneuver on your dial, you may discard this card to rotate your ship 180&deg;.  Then receive 1 stress token <strong>after</strong> the \"Check Pilot Stress\" step."
    },
    "Twin Laser Turret": {
      text: "<strong>Attack:</strong> Perform this attack <strong>twice</strong> (even against a ship outside your firing arc).<br /><br />Each time this attack hits, the defender suffers 1 damage.  Then cancel <strong>all</strong> dice results."
    },
    "Plasma Torpedoes": {
      text: "<strong>Attack (target lock):</strong> Spend your target lock and discard this card to perform this attack.<br /><br />If this attack hits, after dealing damage, remove 1 shield token from the defender."
    },
    "Ion Bombs": {
      text: "When you reveal your maneuver dial, you may discard this card to <strong>drop</strong> 1 ion bomb token.<br /><br />This token <strong>detonates</strong> at the end of the Activation phase.<br /><br /><strong>Ion Bombs Token:</strong> When this bomb token detonates, each ship at Range 1 of the token receives 2 ion tokens.  Then discard this token."
    },
    "Conner Net": {
      text: "<strong>Action:</strong> Discard this card to <strong>drop</strong> 1 Conner Net token.<br /><br />When a ship's base or maneuver template overlaps this token, this token <strong>detonates</strong>.<br /><br /><strong>Conner Net Token:</strong> When this bomb token detonates, the ship that moved through or overlapped this token suffers 1 damage, receives 2 ion tokens, and skips its \"Perform Action\" step.  Then discard this token."
    },
    "Bombardier": {
      text: "When dropping a bomb, you may use the (%STRAIGHT% 2) template instead of the (%STRAIGHT% 1) template."
    },
    'Crack Shot': {
      text: 'When attacking a ship inside your firing arc, at the start of the "Compare Results" step, you may discard this card to cancel 1 of the defender\'s %EVADE% results.'
    },
    "Advanced Homing Missiles": {
      text: "<strong>Attack (target lock):</strong> Discard this card to perform this attack.%LINEBREAK%If this attack hits, deal 1 faceup Damage card to the defender.  Then cancel <strong>all</strong> dice results."
    },
    'Agent Kallus': {
      text: '%IMPERIALONLY%%LINEBREAK%At the start of the first round, choose 1 enemy small or large ship.  When attacking or defending against that ship, you may change 1 of your %FOCUS% results to a %HIT% or %EVADE% result.'
    },
    'XX-23 S-Thread Tracers': {
      text: "<strong>Attack (focus):</strong> Discard this card to perform this attack.  If this attack hits, each friendly ship at Range 1-2 of you may acquire a target lock on the defender.  Then cancel <strong>all</strong> dice results."
    },
    "Tractor Beam": {
      text: "<strong>Attack:</strong> Attack 1 ship.%LINEBREAK%If this attack hits, the defender receives 1 tractor beam token.  Then cancel <strong>all</strong> dice results."
    },
    "Cloaking Device": {
      text: "%SMALLSHIPONLY%%LINEBREAK%<strong>Action:</strong> Perform a free cloak action.%LINEBREAK%At the end of each round, if you are cloaked, roll 1 attack die.  On a %FOCUS% result, discard this card, then decloak or discard your cloak token."
    },
    "Shield Technician": {
      text: "%HUGESHIPONLY%%LINEBREAK%When you perform a recover action, instead of spending all of your energy, you can choose any amount of energy to spend."
    },
    "Weapons Guidance": {
      text: "When attacking, you may spend a focus token to change 1 of your blank results to a %HIT% result."
    },
    "BB-8": {
      text: "When you reveal a green maneuver, you may perform a free barrel roll action."
    },
    "R5-X3": {
      text: "Before you reveal your maneuver, you may discard this card to ignore obstacles until the end of the round."
    },
    "Wired": {
      text: "When attacking or defending, if you are stressed, you may reroll 1 or more of your %FOCUS% results."
    },
    'Cool Hand': {
      text: 'When you receive a stress token, you may discard this card to assign 1 focus or evade token to your ship.'
    },
    'Juke': {
      text: '%SMALLSHIPONLY%%LINEBREAK%When attacking, if you have an evade token, you may change 1 of the defender\'s %EVADE% results into a %FOCUS% result.'
    },
    'Comm Relay': {
      text: 'You cannot have more than 1 evade token.%LINEBREAK%During the End phase, do not remove an unused evade token from your ship.'
    },
    'Dual Laser Turret': {
      text: '%GOZANTIONLY%%LINEBREAK%<strong>Attack (energy):</strong> Spend 1 energy from this card to perform this attack against 1 ship (even a ship outside your firing arc).'
    },
    'Broadcast Array': {
      text: '%GOZANTIONLY%%LINEBREAK%Your action bar gains the %JAM% action icon.'
    },
    'Rear Admiral Chiraneau': {
      text: '%HUGESHIPONLY% %IMPERIALONLY%%LINEBREAK%<strong>Action:</strong> Execute a white (%STRAIGHT% 1) maneuver.'
    },
    'Ordnance Experts': {
      text: 'Once per round, when a friendly ship at Range 1-3 performs an attack with a %TORPEDO% or %MISSILE% secondary weapon, it may change 1 of its blank results to a %HIT% result.'
    },
    'Docking Clamps': {
      text: '%GOZANTIONLY% %LIMITED%%LINEBREAK%You may attach 4 up to TIE fighters, TIE interceptors, TIE bombers, or TIE Advanced to this ship.  All attached ships must have the same ship type.'
    },
    '"Zeb" Orrelios': {
      text: "%REBELONLY%%LINEBREAK%Enemy ships inside your firing arc that you are touching are not considered to be touching you when either you or they activate during the Combat phase."
    },
    'Kanan Jarrus': {
      text: "%REBELONLY%%LINEBREAK%Once per round, after a friendly ship at Range 1-2 executes a white maneuver, you may remove 1 stress token from that ship."
    },
    'Reinforced Deflectors': {
      text: "%LARGESHIPONLY%%LINEBREAK%After you suffer 3 or more damage from an attack, recover one shield (up to your shield value)."
    },
    'Dorsal Turret': {
      text: "<strong>Attack:</strong> Attack 1 ship (even a ship outside your firing arc).%LINEBREAK%If the target of this attack is at Range 1, roll 1 additional attack die."
    },
    'Targeting Astromech': {
      text: 'After you execute a red maneuver, you may acquire a target lock.'
    },
    'Hera Syndulla': {
      text: "%REBELONLY%%LINEBREAK%You may reveal and execute red maneuvers even while you are stressed."
    },
    'Ezra Bridger': {
      text: "%REBELONLY%%LINEBREAK%When attacking, if you are stressed, you may change 1 of your %FOCUS% results to a %CRIT% result."
    },
    'Sabine Wren': {
      text: "%REBELONLY%%LINEBREAK%Your upgrade bar gains the %BOMB% upgrade icon.  Once per round, before a friendly bomb token is removed, choose 1 enemy ship at Range 1 of that token. That ship suffers 1 damage."
    },
    '"Chopper"': {
      text: "%REBELONLY%%LINEBREAK%You may perform actions even while you are stressed.%LINEBREAK%After you perform an action while you are stressed, suffer 1 damage."
    },
    'Construction Droid': {
      text: '%HUGESHIPONLY% %LIMITED%%LINEBREAK%When you perform a recover action, you may spend 1 energy to discard 1 facedown Damage card.'
    },
    'Cluster Bombs': {
      text: 'After defending, you may discard this card.  If you do, each other ship at Range 1 of the defending section rolls 2 attack dice, suffering all damage (%HIT%) and critical damage (%CRIT%) rolled.'
    },
    "Adaptability (+1)": {
      text: "<span class=\"card-restriction\">Dual card.</span>%LINEBREAK%Increase your pilot skill value by 1."
    },
    "Adaptability (-1)": {
      text: "<span class=\"card-restriction\">Dual card.</span>%LINEBREAK%Decrease your pilot skill value by 1."
    },
    "Electronic Baffle": {
      text: "When you receive a stress token or an ion token, you may suffer 1 damage to discard that token."
    },
    "4-LOM": {
      text: "%SCUMONLY%%LINEBREAK%When attacking, during the \"Modify Attack Dice\" step, you may receive 1 ion token to choose 1 of the defender's focus or evade tokens.  That token cannot be spent during this attack."
    },
    "Zuckuss": {
      text: "%SCUMONLY%%LINEBREAK%When attacking, you may receive any number of stress tokens to choose an equal number of defense dice.  The defender must reroll those dice."
    },
    'Rage': {
      text: "<strong>Action:</strong> Assign 1 focus token to your ship and receive 2 stress tokens.  Until the end of the round, when attacking, you may reroll up to 3 attack dice."
    },
    "Attanni Mindlink": {
      text: "%SCUMONLY%%LINEBREAK%Each time you are assigned a focus or stress token, each other friendly ship with Attanni Mindlink must also be assigned the same type of token if it does not already have one."
    },
    "Boba Fett": {
      text: "%SCUMONLY%%LINEBREAK%After performing an attack, if the defender was dealt a faceup Damage card, you may discard this card to choose and discard 1 of the defender's Upgrade cards."
    },
    "Dengar": {
      text: "%SCUMONLY%%LINEBREAK%When attacking, you may reroll 1 attack die.  If the defender is a unique pilot, you may instead reroll up to 2 attack dice."
    },
    '"Gonk"': {
      text: "%SCUMONLY%%LINEBREAK%<strong>Action:</strong> Place 1 shield token on this card.%LINEBREAK%<strong>Action:</strong> Remove 1 shield token from this card to recover 1 shield (up to your shield value)."
    },
    "R5-P8": {
      text: "Once per round, after defending, you may roll 1 attack die.  On a %HIT% result, the attacker suffers 1 damage.  On a %CRIT% result, you and the attacker each suffer 1 damage."
    },
    'Thermal Detonators': {
      text: "When you reveal your maneuver dial, you may discard this card to <strong>drop</strong> 1 thermal detonator token.%LINEBREAK%This token <strong>detonates</strong> at the end of the Activation phase.%LINEBREAK%<strong>Thermal Detonator Token:</strong> When this bomb token detonates, each ship at Range 1 of the token suffers 1 damage and receives 1 stress token.  Then discard this token."
    },
    "Overclocked R4": {
      text: "During the Combat phase, when you spend a focus token, you may receive 1 stress token to assign 1 focus token to your ship."
    }
  };
  modification_translations = {
    "Stealth Device": {
      text: "Increase your agility value by 1.  If you are hit by an attack, discard this card."
    },
    "Shield Upgrade": {
      text: "Increase your shield value by 1."
    },
    "Engine Upgrade": {
      text: "Your action bar gains the %BOOST% action icon."
    },
    "Anti-Pursuit Lasers": {
      text: "%LARGESHIPONLY%%LINEBREAK%After an enemy ship executes a maneuver that causes it to overlap your ship, roll 1 attack die.  On a %HIT% or %CRIT% result, the enemy ship suffers 1 damage."
    },
    "Targeting Computer": {
      text: "Your action bar gains the %TARGETLOCK% action icon."
    },
    "Hull Upgrade": {
      text: "Increase your hull value by 1."
    },
    "Munitions Failsafe": {
      text: "When attacking with a secondary weapon that instructs you to discard it to perform the attack, do not discard it unless the attack hits."
    },
    "Stygium Particle Accelerator": {
      text: "When you either decloak or perform a cloak action, you may perform a free evade action."
    },
    "Advanced Cloaking Device": {
      text: "<span class=\"card-restriction\">TIE Phantom only.</span>%LINEBREAK%After you perform an attack, you may perform a free cloak action."
    },
    "Combat Retrofit": {
      text: "<span class=\"card-restriction\">GR-75 only.</span>%LINEBREAK%Increase your hull value by 2 and your shield value by 1."
    },
    "B-Wing/E2": {
      text: "<span class=\"card-restriction\">B-Wing only.</span>%LINEBREAK%Your upgrade bar gains the %CREW% upgrade icon."
    },
    "Countermeasures": {
      text: "%LARGESHIPONLY%%LINEBREAK%At the start of the Combat phase, you may discard this card to increase your agility value by 1 until the end of the round.  Then you may remove 1 enemy target lock from your ship."
    },
    "Experimental Interface": {
      text: "Once per round, after you perform an action, you may perform 1 free action from an equipped Upgrade card with the \"<strong>Action:</strong>\" header.  Then receive 1 stress token."
    },
    "Tactical Jammer": {
      text: "%LARGESHIPONLY%%LINEBREAK%Your ship can obstruct enemy attacks."
    },
    "Autothrusters": {
      text: "When defending, if you are beyond Range 2 or outside the attacker's firing arc, you may change 1 of your blank results to a %EVADE% result. You can equip this card only if you have the %BOOST% action icon."
    },
    "Advanced SLAM": {
      text: "After performing a SLAM action, if you did not overlap an obstacle or another ship, you may perform a free action."
    },
    "Twin Ion Engine Mk. II": {
      text: "You may treat all bank maneuvers (%BANKLEFT% and %BANKRIGHT%) as green maneuvers."
    },
    "Maneuvering Fins": {
      text: "When you reveal a turn maneuver (%TURNLEFT% or %TURNRIGHT%), you may rotate your dial to the corresponding bank maneuver (%BANKLEFT% or %BANKRIGHT%) of the same speed."
    },
    "Ion Projector": {
      text: "%LARGESHIPONLY%%LINEBREAK%After an enemy ship executes a maneuver that causes it to overlap your ship, roll 1 attack die.  On a %HIT% or %CRIT% result, the enemy ship receives 1 ion token."
    },
    'Integrated Astromech': {
      text: '<span class="card-restriction">X-wing only.</span>%LINEBREAK%When you are dealt a Damage card, you may discard 1 of your %ASTROMECH% Upgrade cards to discard that Damage card.'
    },
    'Optimized Generators': {
      text: '%HUGESHIPONLY%%LINEBREAK%Once per round, when you assign energy to an equipped Upgrade card, gain 2 energy.'
    },
    'Automated Protocols': {
      text: '%HUGESHIPONLY%%LINEBREAK%Once per round, after you perform an action that is not a recover or reinforce action, you may spend 1 energy to perform a free recover or reinforce action.'
    },
    'Ordnance Tubes': {
      text: '%HUGESHIPONLY%%LINEBREAK%You may treat each of your %HARDPOINT% upgrade icons as a %TORPEDO% or %MISSILE% icon.%LINEBREAK%When you are instructed to discard a %TORPEDO% or %MISSILE% Upgrade card, do not discard it.'
    },
    'Long-Range Scanners': {
      text: 'You can acquire target locks on ships at Range 3 and beyond.  You cannot acquire target locks on ships at Range 1-2.  You can equip this card only if you have %TORPEDO% and %MISSILE% in your upgrade bar.'
    },
    "Guidance Chips": {
      text: "Once per round, when attacking with a %TORPEDO% or %MISSILE% secondary weapon, you may change 1 die result to a %HIT% result (or a %CRIT% result if your primary weapon value is \"3\" or higher)."
    }
  };
  title_translations = {
    "Slave I": {
      text: "<span class=\"card-restriction\">Firespray-31 only.</span>%LINEBREAK%Your upgrade bar gains the %TORPEDO% upgrade icon."
    },
    "Millennium Falcon": {
      text: "<span class=\"card-restriction\">YT-1300 only.</span>%LINEBREAK%Your action bar gains the %EVADE% action icon."
    },
    "Moldy Crow": {
      text: "<span class=\"card-restriction\">HWK-290 only.</span>%LINEBREAK%During the End phase, do not remove unused focus tokens from your ship."
    },
    "ST-321": {
      text: "<span class=\"card-restriction\"><em>Lambda</em>-class Shuttle only.</span>%LINEBREAK%When acquiring a target lock, you may lock onto any enemy ship in the play area."
    },
    "Royal Guard TIE": {
      text: "<span class=\"card-restriction\">TIE Interceptor only.</span>%LINEBREAK%You may equip up to 2 different Modification upgrades (instead of 1).%LINEBREAK%You cannot equip this card if your pilot skill value is \"4\" or lower."
    },
    "Dodonna's Pride": {
      text: "<span class=\"card-restriction\">CR90 fore section only.</span>%LINEBREAK%When you perform a coordinate action, you may choose 2 friendly ships (instead of 1).  Those ships may each perform 1 free action."
    },
    "A-Wing Test Pilot": {
      text: "<span class=\"card-restriction\">A-Wing only.</span>%LINEBREAK%Your upgrade bar gains 1 %ELITE% upgrade icon.%LINEBREAK%You cannot equip 2 of the same %ELITE% Upgrade cards.  You cannot equip this if your pilot skill value is \"1\" or lower."
    },
    "Tantive IV": {
      text: "<span class=\"card-restriction\">CR90 fore section only.</span>%LINEBREAK%Your fore section upgrade bar gains 1 additional %CREW% and 1 additional %TEAM% upgrade icon."
    },
    "Bright Hope": {
      text: "<span class=\"card-restriction\">GR-75 only.</span>%LINEBREAK%A reinforce action assigned to your fore section adds 2 %EVADE% results (instead of 1)."
    },
    "Quantum Storm": {
      text: "<span class=\"card-restriction\">GR-75 only.</span>%LINEBREAK%At the start of the End phase, if you have 1 or fewer energy tokens, gain 1 energy token."
    },
    "Dutyfree": {
      text: "<span class=\"card-restriction\">GR-75 only.</span>%LINEBREAK%When performing a jam action, you may choose an enemy ship at Range 1-3 (instead of at Range 1-2)."
    },
    "Jaina's Light": {
      text: "<span class=\"card-restriction\">CR90 fore section only.</span>%LINEBREAK%When defending, once per attack, if you are dealt a faceup Damage card, you may discard it and draw another faceup Damage card."
    },
    "Outrider": {
      text: "<span class=\"card-restriction\">YT-2400 only.</span>%LINEBREAK%While you have a %CANNON% Upgrade card equipped, you <strong>cannot</strong> perform primary weapon attacks and you may perform %CANNON% secondary weapon attacks against ships outside your firing arc."
    },
    "Dauntless": {
      text: "<span class=\"card-restriction\">VT-49 Decimator only.</span>%LINEBREAK%After you execute a maneuver that causes you to overlap another ship, you may perform 1 free action.  Then receive 1 stress token."
    },
    "Virago": {
      text: "<span class=\"card-restriction\">StarViper only.</span>%LINEBREAK%Your upgrade bar gains the %SYSTEM% and %ILLICIT% upgrade icons.%LINEBREAK%You cannot equip this card if your pilot skill value is \"3\" or lower."
    },
    '"Heavy Scyk" Interceptor (Cannon)': {
      text: "<span class=\"card-restriction\">M3-A Interceptor only.</span>%LINEBREAK%Your upgrade bar gains the %CANNON%, %TORPEDO%, or %MISSILE% upgrade icon."
    },
    '"Heavy Scyk" Interceptor (Torpedo)': {
      text: "<span class=\"card-restriction\">M3-A Interceptor only.</span>%LINEBREAK%Your upgrade bar gains the %CANNON%, %TORPEDO%, or %MISSILE% upgrade icon."
    },
    '"Heavy Scyk" Interceptor (Missile)': {
      text: "<span class=\"card-restriction\">M3-A Interceptor only.</span>%LINEBREAK%Your upgrade bar gains the %CANNON%, %TORPEDO%, or %MISSILE% upgrade icon."
    },
    "IG-2000": {
      text: "<span class=\"card-restriction\">Aggressor only.</span>%LINEBREAK%You have the pilot ability of each other friendly ship with the <em>IG-2000</em> Upgrade card (in addition to your own pilot ability)."
    },
    "BTL-A4 Y-Wing": {
      text: "<span class=\"card-restriction\">Y-Wing only.</span>%LINEBREAK%You cannot attack ships outside your firing arc. After you perform a primary weapon attack, you may immediately perform an attack with a %TURRET% secondary weapon."
    },
    "Andrasta": {
      text: "Your upgrade bar gains two additional %BOMB% upgrade icons."
    },
    "TIE/x1": {
      text: "<span class=\"card-restriction\">TIE Advanced only.</span>%LINEBREAK%Your upgrade bar gains the %SYSTEM% upgrade icon.%LINEBREAK%If you equip a %SYSTEM% upgrade, its squad point cost is reduced by 4 (to a minimum of 0)."
    },
    "Hound's Tooth": {
      text: "<span class=\"card-restriction\">YV-666 only.</span>%LINEBREAK%After you are destroyed, before you are removed from the play area, you may <strong>deploy</strong> the <em>Nashtah Pup</em> ship.%LINEBREAK%It cannot attack this round."
    },
    "Ghost": {
      text: "<span class=\"card-restriction\">VCX-100 only.</span>%LINEBREAK%Equip the <em>Phantom</em> title card to a friendly Attack Shuttle and dock it to this ship.%LINEBREAK%After you execute a maneuver, you may deploy it from your rear guides."
    },
    "Phantom": {
      text: "While you are docked, the <em>Ghost</em> can perform primary weapon attacks from its special firing arc, and, at the end of the Combat phase, it may perform an additional attack with an equipped %TURRET%. If it performs this attack, it cannot attack again this round."
    },
    "TIE/v1": {
      text: "<span class=\"card-restriction\">TIE Advanced Prototype only.</span>%LINEBREAK%After you acquire a target lock, you may perform a free evade action."
    },
    "Mist Hunter": {
      text: "<span class=\"card-restriction\">G-1A starfighter only.</span>%LINEBREAK%Your upgrade bar gains the %BARRELROLL% Upgrade icon.%LINEBREAK%You <strong>must</strong> equip 1 \"Tractor Beam\" Upgrade card (paying its squad point cost as normal)."
    },
    "Punishing One": {
      text: "<span class=\"card-restriction\">JumpMaster 5000 only.</span>%LINEBREAK%Increase your primary weapon value by 1."
    },
    "Assailer": {
      text: "<span class=\"card-restriction\"><em>Raider</em>-class corvette aft section only.</span>%LINEBREAK%When defending, if the targeted section has a reinforce token, you may change 1 %FOCUS% result to a %EVADE% result."
    },
    "Instigator": {
      text: "<span class=\"card-restriction\"><em>Raider</em>-class corvette aft section only.</span>%LINEBREAK%After you perform a recover action, recover 1 additional shield."
    },
    "Impetuous": {
      text: "<span class=\"card-restriction\"><em>Raider</em>-class corvette aft section only.</span>%LINEBREAK%After you perform an attack that destroys an enemy ship, you may acquire a target lock."
    },
    'TIE/x7': {
      text: '<span class="card-restriction">TIE Defender only.</span>%LINEBREAK%Your upgrade bar loses the %CANNON% and %MISSILE% upgrade icons.%LINEBREAK%After executing a 3-, 4-, or 5-speed maneuver, you may assign 1 evade token to your ship.'
    },
    'TIE/D': {
      text: '<span class="card-restriction">TIE Defender only.</span>%LINEBREAK%Once per round, after you perform an attack with a %CANNON% secondary weapon that costs 3 or fewer squad points, you may perform a primary weapon attack.'
    },
    'TIE Shuttle': {
      text: '<span class="card-restriction">TIE Bomber only.</span>%LINEBREAK%Your upgrade bar loses all %TORPEDO%, %MISSILE%, and %BOMB% upgrade icons and gains 2 %CREW% upgrade icons.  You cannot equip a %CREW% Upgrade card that costs more than 4 squad points.'
    },
    'Requiem': {
      text: '%GOZANTIONLY%%LINEBREAK%When you deploy a ship, treat its pilot skill value as "8" until the end of the round.'
    },
    'Vector': {
      text: '%GOZANTIONLY%%LINEBREAK%After you execute a maneuver, you may deploy up to 4 attached ships (instead of 2).'
    },
    'Suppressor': {
      text: '%GOZANTIONLY%%LINEBREAK%Once per round, after you acquire a target lock, you may remove 1 focus, evade, or blue target lock token from that ship.'
    }
  };
  return exportObj.setupCardData(basic_cards, pilot_translations, upgrade_translations, modification_translations, title_translations);
};

exportObj = typeof exports !== "undefined" && exports !== null ? exports : this;

if (exportObj.codeToLanguage == null) {
  exportObj.codeToLanguage = {};
}

exportObj.codeToLanguage.es = 'Español';

if (exportObj.translations == null) {
  exportObj.translations = {};
}

exportObj.translations['Español'] = {
  action: {
    "Barrel Roll": "Tonel Volado",
    "Boost": "Impulso",
    "Evade": "Evadir",
    "Focus": "Concentración",
    "Target Lock": "Blanco Fijado",
    "Recover": "Recuperar",
    "Reinforce": "Reforzar",
    "Jam": "Interferir",
    "Coordinate": "Coordinar",
    "Cloak": "Camuflaje"
  },
  slot: {
    "Astromech": "Droide Astromech",
    "Bomb": "Bomba",
    "Cannon": "Cañón",
    "Crew": "Tripulación",
    "Elite": "Élite",
    "Missile": "Misiles",
    "System": "Sistemas",
    "Torpedo": "Torpedos",
    "Turret": "Torreta",
    "Cargo": "Carga",
    "Hardpoint": "Hardpoint",
    "Team": "Equipo",
    "Illicit": "Ilícita",
    "Salvaged Astromech": "Droide Astromech Remendado",
    "Tech": "Tecnología"
  },
  sources: {
    "Core": "Caja Básica",
    "A-Wing Expansion Pack": "Pack de Expansión Ala-A",
    "B-Wing Expansion Pack": "Pack de Expansión Ala-B",
    "X-Wing Expansion Pack": "Pack de Expansión Ala-X",
    "Y-Wing Expansion Pack": "Pack de Expansión Ala-Y",
    "Millennium Falcon Expansion Pack": "Pack de Expansión Halcón Milenario",
    "HWK-290 Expansion Pack": "Pack de Expansión HWK-290",
    "TIE Fighter Expansion Pack": "Pack de Expansión Caza TIE",
    "TIE Interceptor Expansion Pack": "Pack de Expansión Interceptor TIE",
    "TIE Bomber Expansion Pack": "Pack de Expansión Bombardero TIE",
    "TIE Advanced Expansion Pack": "Pack de Expansión TIE Avanzado",
    "Lambda-Class Shuttle Expansion Pack": "Pack de Expansión Lanzadera clase LAmbda",
    "Slave I Expansion Pack": "Pack de Expansión Esclavo 1",
    "Imperial Aces Expansion Pack": "Pack de Expansión Ases Imperiales",
    "Rebel Transport Expansion Pack": "Pack de Expansión Transporte Rebelde",
    "Z-95 Headhunter Expansion Pack": "Pack de Expansión Z-95 Cazacabezas",
    "TIE Defender Expansion Pack": "Pack de Expansión Defensor TIE",
    "E-Wing Expansion Pack": "Pack de Expansión Ala-E",
    "TIE Phantom Expansion Pack": "Pack de Expansión TIE Fantasma",
    "Tantive IV Expansion Pack": "Pack de Expansión Tantive IV",
    "Rebel Aces Expansion Pack": "Pack de Expansión Ases Rebeldes",
    "YT-2400 Freighter Expansion Pack": "Pack de Expansión Carguero YT-2400",
    "VT-49 Decimator Expansion Pack": "Pack de Expansión VT-49 Diezmador",
    "StarViper Expansion Pack": "Pack de Expansión Víbora Estelar",
    "M3-A Interceptor Expansion Pack": "Pack de Expansión Interceptor M3-A",
    "IG-2000 Expansion Pack": "Pack de Expansión IG-2000",
    "Most Wanted Expansion Pack": "Pack de Expansión Los Más Buscados",
    "Imperial Raider Expansion Pack": "Pack de Expansión Incursor Imperial",
    "K-Wing Expansion Pack": "Pack de Expansión Ala-K",
    "TIE Punisher Expansion Pack": "Pack de Expansión Castigador TIE",
    "Kihraxz Fighter Expansion Pack": "Pack de Expansión Caza Kihraxz",
    "Hound's Tooth  Expansion Pack": "Pack de Expansión Diente de Perro",
    "The Force Awakens Core Set": "Caja Básica El Despertar de la Fuerza",
    "T-70 X-Wing Expansion Pack": "Pack de Expansión T-70 Ala-X",
    "TIE/fo Fighter Expansion Pack": "Pack de Expansión Caza TIE/fo",
    "Imperial Assault Carrier Expansion Pack": "Pack de Expansión Portacazas de Asalto Imperial"
  },
  ui: {
    shipSelectorPlaceholder: "Selecciona una nave",
    pilotSelectorPlaceholder: "Selecciona un piloto",
    upgradePlaceholder: function(translator, language, slot) {
      switch (slot) {
        case 'Elite':
          return "Sin Talento de Élite";
        case 'Astromech':
          return "Sin Droide Astromecánico";
        case 'Illicit':
          return "Sin Mejora Ilícita";
        case 'Salvaged Astromech':
          return "Sin Droide Astromech Remendado";
        default:
          return "Sin Mejora de " + (translator(language, 'slot', slot));
      }
    },
    modificationPlaceholder: "Sin Modificación",
    titlePlaceholder: "Sin Título",
    upgradeHeader: function(translator, language, slot) {
      switch (slot) {
        case 'Elite':
          return "Talento de Élite";
        case 'Astromech':
          return "Droide Astromecánico";
        case 'Illicit':
          return "Mejora Ilícita";
        case 'Salvaged Astromech':
          return "Droide Astromech Remendado";
        default:
          return "Mejora de " + (translator(language, 'slot', slot));
      }
    },
    unreleased: "inédito",
    epic: "épico"
  },
  byCSSSelector: {
    '.xwing-card-browser .translate.sort-cards-by': 'Ordenar cartas por',
    '.xwing-card-browser option[value="name"]': 'Nombre',
    '.xwing-card-browser option[value="source"]': 'Fuente',
    '.xwing-card-browser option[value="type-by-points"]': 'Tipo (por Puntos)',
    '.xwing-card-browser option[value="type-by-name"]': 'Tipo (por Nombre)',
    '.xwing-card-browser .translate.select-a-card': 'Selecciona una carta del listado de la izquierda.',
    '.info-well .info-ship td.info-header': 'Nave',
    '.info-well .info-skill td.info-header': 'Habilidad',
    '.info-well .info-actions td.info-header': 'Acciones',
    '.info-well .info-upgrades td.info-header': 'Mejoras',
    '.info-well .info-range td.info-header': 'Alcance',
    '.clear-squad': 'Nuevo Escuadron',
    '.save-list': 'Grabar',
    '.save-list-as': 'Grabar como...',
    '.delete-list': 'Eliminar',
    '.backend-list-my-squads': 'Cargar Escuadron',
    '.view-as-text': '<span class="hidden-phone"><i class="icon-print"></i>&nbsp;Imprimir/Ver como </span>Text',
    '.randomize': 'Aleatorio!',
    '.randomize-options': 'Opciones de aleatoriedad…',
    '.notes-container > span': 'Squad Notes',
    '.bbcode-list': 'Copia el BBCode de debajo y pegalo en el post de tu foro.<textarea></textarea><button class="btn btn-copy">Copia</button>',
    '.html-list': '<textarea></textarea><button class="btn btn-copy">Copia</button>',
    '.vertical-space-checkbox': "Añade espacio para cartas de daño/mejora cuando imprima. <input type=\"checkbox\" class=\"toggle-vertical-space\" />",
    '.color-print-checkbox': "Imprima en color. <input type=\"checkbox\" class=\"toggle-color-print\" />",
    '.print-list': '<i class="icon-print"></i>&nbsp;Imprimir',
    '.do-randomize': 'Genera Aleatoriamente!',
    '#empireTab': 'Imperio Galactico',
    '#rebelTab': 'Alianza Rebelde',
    '#scumTab': 'Escoria y Villanos',
    '#browserTab': 'Explorador de Cartas',
    '#aboutTab': 'Acerca de'
  },
  singular: {
    'pilots': 'Piloto',
    'modifications': 'Modificación',
    'titles': 'Título'
  },
  types: {
    'Pilot': 'Piloto',
    'Modification': 'Modificación',
    'Title': 'Título'
  }
};

if (exportObj.cardLoaders == null) {
  exportObj.cardLoaders = {};
}

exportObj.cardLoaders['Español'] = function() {
  var basic_cards, modification_translations, pilot_translations, title_translations, upgrade_translations;
  exportObj.cardLanguage = 'Español';
  basic_cards = exportObj.basicCardData();
  exportObj.canonicalizeShipNames(basic_cards);
  exportObj.ships = basic_cards.ships;
  exportObj.renameShip('Lambda-Class Shuttle', 'Lanzadera clase Lambda');
  exportObj.renameShip('TIE Advanced', 'TIE Avanzado');
  exportObj.renameShip('TIE Bomber', 'Bombardero TIE');
  exportObj.renameShip('TIE Fighter', 'Caza TIE');
  exportObj.renameShip('TIE Interceptor', 'Interceptor TIE');
  exportObj.renameShip('TIE Phantom', 'TIE Fantasma');
  exportObj.renameShip('TIE Defender', 'Defensor TIE');
  exportObj.renameShip('TIE Punisher', 'Castigador TIE');
  exportObj.renameShip('VT-49 Decimator', 'VT-49 Diezmador');
  exportObj.renameShip('TIE/fo Fighter', 'Caza TIE/fo');
  exportObj.renameShip('A-Wing', 'Ala-A');
  exportObj.renameShip('B-Wing', 'Ala-B');
  exportObj.renameShip('E-Wing', 'Ala-E');
  exportObj.renameShip('X-Wing', 'Ala-X');
  exportObj.renameShip('Y-Wing', 'Ala-Y');
  exportObj.renameShip('K-Wing', 'Ala-K');
  exportObj.renameShip('Z-95 Headhunter', 'Z-95 Cazacabezas');
  exportObj.renameShip('CR90 Corvette (Aft)', 'Corbeta CR90 (Popa)');
  exportObj.renameShip('CR90 Corvette (Fore)', 'Corbeta CR90 (Proa)');
  exportObj.renameShip('GR-75 Medium Transport', 'Transporte mediano GR-75');
  exportObj.renameShip('T-70 X-Wing', 'T-70 Ala-X');
  exportObj.renameShip('M3-A Interceptor', 'Interceptor M3-A');
  exportObj.renameShip('StarViper', 'Víbora Estelar');
  exportObj.renameShip('Aggressor', 'Agresor');
  exportObj.renameShip('Kihraxz Fighter', 'Caza Kihraxz');
  pilot_translations = {
    "Wedge Antilles": {
      text: "Cuando ataques, la Agilidad del piloto se reduce en 1 (hasta un mínimo de 0).",
      ship: "Ala-X"
    },
    "Garven Dreis": {
      text: "Después de gastar una ficha de Concentración, en vez de descartarla puedes asignar esa ficha a cualquier otra nave aliada que tengas a alcance 1-2.",
      ship: "Ala-X"
    },
    "Red Squadron Pilot": {
      name: "Piloto del escuadrón Rojo",
      ship: "Ala-X"
    },
    "Rookie Pilot": {
      name: "Piloto Novato",
      ship: "Ala-X"
    },
    "Biggs Darklighter": {
      text: "Las demás naves aliadas que tengas a alcance 1 no pueden ser seleccionadas como objetivo de ataques si en vez de eso el atacante pudiese seleccionarte a tí como objetivo.",
      ship: "Ala-X"
    },
    "Luke Skywalker": {
      text: "Cuando te defiendas en combate puedes cambiar 1 de tus resultados %FOCUS% por un resultado %EVADE%.",
      ship: "Ala-X"
    },
    "Gray Squadron Pilot": {
      name: "Piloto del escuadrón Gris",
      ship: "Ala-Y"
    },
    '"Dutch" Vander': {
      text: "Después de que fijes un blanco, elige otra nave aliada que tengas a alcance 1-2. La nave elegida podrá fijar un blanco inmediatamente.",
      ship: "Ala-Y"
    },
    "Horton Salm": {
      text: "Cuando ataques a alcance 2-3, puedes volver a lanzar cualesquier dados en los que hayas sacado caras vacías.",
      ship: "Ala-Y"
    },
    "Gold Squadron Pilot": {
      name: "Piloto del escuadrón Oro",
      ship: "Ala-Y"
    },
    "Academy Pilot": {
      name: "Piloto de la Academia",
      ship: "Caza TIE"
    },
    "Obsidian Squadron Pilot": {
      name: "Piloto del escuadrón Obsidiana",
      ship: "Caza TIE"
    },
    "Black Squadron Pilot": {
      name: "Piloto del escuadrón Negro",
      ship: "Caza TIE"
    },
    '"Winged Gundark"': {
      name: '"Gundark Alado"',
      text: "Cuando ataques a alcance 1, puedes cambiar 1 de tus resultados %HIT% por un resultado %CRIT%",
      ship: "Caza TIE"
    },
    '"Night Beast"': {
      name: '"Bestia Nocturna"',
      text: "Después de que ejecutes una maniobra verde, puedes realizar una acción gratuita de Concentración",
      ship: "Caza TIE"
    },
    '"Backstabber"': {
      name: '"Asesino Furtivo"',
      text: "Cuando ataques desde fuera del arco de fuego del defensor, tira 1 dado de ataque adicional.",
      ship: "Caza TIE"
    },
    '"Dark Curse"': {
      name: '"Maldición Oscura"',
      text: "Cuando te defiendas en combate, las naves que te ataquen no podrán gastar fichas de Concentración ni volver a tirar dados de ataque.",
      ship: "Caza TIE"
    },
    '"Mauler Mithel"': {
      name: '"Mutilador Mithel"',
      text: "Si atacas a alcance 1, tira 1 dado de ataque adicional.",
      ship: "Caza TIE"
    },
    '"Howlrunner"': {
      name: '"Aullador Veloz"',
      text: "Cuando otra nave aliada que tengas a alcance 1 ataque con su armamento principal, podrá volver a tirar 1 dado de ataque.",
      ship: "Caza TIE"
    },
    "Tempest Squadron Pilot": {
      name: "Piloto del escuadrón Tempestad",
      ship: "TIE Avanzado"
    },
    "Storm Squadron Pilot": {
      name: "Piloto del escuadrón Tormenta",
      ship: "TIE Avanzado"
    },
    "Maarek Stele": {
      text: "Cuando tu ataque inflija una carta de Daño boca arriba al defensor, en vez de eso roba 3 cartas de Daño, elige 1 de ellas a tu elección y luego descarta las otras.",
      ship: "TIE Avanzado"
    },
    "Darth Vader": {
      text: "Puedes llevar a cabo dos acciones durante tu paso de acción.",
      ship: "TIE Avanzado"
    },
    "Alpha Squadron Pilot": {
      name: "Piloto del escuadrón Alfa",
      ship: "Interceptor TIE"
    },
    "Avenger Squadron Pilot": {
      name: "Piloto del escuadrón Vengador",
      ship: "Interceptor TIE"
    },
    "Saber Squadron Pilot": {
      name: "Piloto del escuadrón Sable",
      ship: "Interceptor TIE"
    },
    "\"Fel's Wrath\"": {
      name: '"Ira de Fel"',
      ship: "Interceptor TIE",
      text: "Cuando tengas asignadas tantas cartas de Daño como tu Casco o más, no serás destruido hasta el final de la fase de Combate."
    },
    "Turr Phennir": {
      ship: "Interceptor TIE",
      text: "Después de que efectúes un ataque, puedes llevar a cabo una acción gratuita de impulso o tonel volado."
    },
    "Soontir Fel": {
      ship: "Interceptor TIE",
      text: "Cuando recibas una ficha de Tensión, puedes asignar 1 ficha de Concentración a tu nave."
    },
    "Tycho Celchu": {
      text: "Puedes realizar acciones incluso aunque tengas fichas de Tensión.",
      ship: "Ala-A"
    },
    "Arvel Crynyd": {
      text: "Puedes designar como objetivo de tu ataque a una nave enemiga que esté dentro de tu arco de ataque y en contacto contigo.",
      ship: "Ala-A"
    },
    "Green Squadron Pilot": {
      name: "Piloto del escuadrón Verde",
      ship: "Ala-A"
    },
    "Prototype Pilot": {
      name: "Piloto de pruebas",
      ship: "Ala-A"
    },
    "Outer Rim Smuggler": {
      name: "Contrabandista del Borde Exterior"
    },
    "Chewbacca": {
      text: "Cuando recibas una carta de Daño boca arriba, ponla boca abajo inmediatamente sin resolver su texto de reglas."
    },
    "Lando Calrissian": {
      text: "Después de que ejecutes una maniobra verde, elige otra nave aliada que tengas a alcance 1. Esa nave podrá realizar una acción gratuita de las indicadas en su barra de acciones."
    },
    "Han Solo": {
      text: "Cuando ataques, puedes volver a tirar todos tus dados. Si decides hacerlo, debes volver a tirar tantos como te sea posible."
    },
    "Bounty Hunter": {
      name: "Cazarrecompensas"
    },
    "Kath Scarlet": {
      text: "Cuando ataques, el defensor recibe 1 ficha de Tensión si anula al menos 1 resultado %CRIT%."
    },
    "Boba Fett": {
      text: "Cuando realices una maniobra de inclinación (%BANKLEFT% o %BANKRIGHT%), puedes girar tu selector de maniobras para escoger la otra maniobra de inclinación de la misma velocidad."
    },
    "Krassis Trelix": {
      text: "Cuando ataques con un armamento secundario, puedes volver a tirar 1 dado de ataque."
    },
    "Ten Numb": {
      text: "Cuando atacas, 1 de tus resultados %CRIT% no puede ser anulado por los dados de defensa.",
      ship: "Ala-B"
    },
    "Ibtisam": {
      text: "Cuando atacas o te defiendes, si tienes al menos 1 ficha de Tensión, puedes volver a tirar 1 de tus dados.",
      ship: "Ala-B"
    },
    "Dagger Squadron Pilot": {
      name: "Piloto del escuadrón Daga",
      ship: "Ala-B"
    },
    "Blue Squadron Pilot": {
      name: "Piloto del escuadrón Azul",
      ship: "Ala-B"
    },
    "Rebel Operative": {
      name: "Operador Rebelde"
    },
    "Roark Garnet": {
      text: "Al comienzo de la fase de Combate, elige otra nave aliada que tengas a alcance 1-3. Hasta el final de la fase, se considera que el piloto de esa nave tiene habilidad 12."
    },
    "Kyle Katarn": {
      text: "Al comienzo de la fase de Combate, puedes asignar 1 de tus fichas de Concentración a otra nave aliada que tengas a alcance 1-3."
    },
    "Jan Ors": {
      text: "Cuando otra nave aliada que tengas a alcance 1-3 efectúe un ataque, si no tienes fichas de Tensión puedes recibir 1 ficha de Tensión para que esa nave tire 1 dado de ataque adicional."
    },
    "Scimitar Squadron Pilot": {
      name: "Piloto del escuadrón Cimitarra",
      ship: "Bombardero TIE"
    },
    "Gamma Squadron Pilot": {
      name: "Piloto del escuadrón Gamma",
      ship: "Bombardero TIE"
    },
    "Captain Jonus": {
      name: "Capitán Jonus",
      ship: "Bombardero TIE",
      text: "Cuando otra nave aliada que tengas a alcance 1 ataque con un sistema de armamento secundario, puede volver a tirar un máximo de 2 dados de ataque."
    },
    "Major Rhymer": {
      name: "Comandante Rhymer",
      ship: "Bombardero TIE",
      text: "Cuando atacas con un sistema de armamento secundario, puedes incrementar o reducir en 1 el alcance del arma (hasta un límite de alcance comprendido entre 1 y 3)."
    },
    "Omicron Group Pilot": {
      name: "Piloto del grupo Omicrón",
      ship: "Lanzadera clase Lambda"
    },
    "Captain Kagi": {
      name: "Capitán Kagi",
      text: "Cuando una nave enemiga fije un blanco, deberá fijar tu nave como blanco (si es posible).",
      ship: "Lanzadera clase Lambda"
    },
    "Colonel Jendon": {
      name: "Coronel Jendon",
      text: "Al comienzo de la fase de Combate, puedes asignar 1 de tus fichas azules de Blanco Fijado a una nave aliada que tengas a alcance 1 si no tiene ya una ficha azul de Blanco Fijado.",
      ship: "Lanzadera clase Lambda"
    },
    "Captain Yorr": {
      name: "Capitán Yorr",
      text: "Cuando otra nave aliada que tengas a alcance 1-2 vaya a recibir una ficha de Tensión, si tienes 2 fichas de Tensión o menos puedes recibirla tú en su lugar.",
      ship: "Lanzadera clase Lambda"
    },
    "Lieutenant Lorrir": {
      ship: "Interceptor TIE",
      text: "Cuando realices una acción de tonel volado, puedes recibir 1 ficha de Tensión para utilizar la plantilla (%BANKLEFT% 1) o la de (%BANKRIGHT% 1) en vez de la plantilla de (%STRAIGHT% 1)."
    },
    "Royal Guard Pilot": {
      name: "Piloto de la Guardia Real",
      ship: "Interceptor TIE"
    },
    "Tetran Cowall": {
      ship: "Interceptor TIE",
      text: "Cuando reveles una maniobra %UTURN%, puedes ejecutarla como si su velocidad fuese de 1, 3 ó 5."
    },
    "Kir Kanos": {
      ship: "Interceptor TIE",
      text: "Cuando ataques desde alcance 2-3, puedes gastar 1 ficha de Evasión para añadir 1 resultado %HIT% a tu tirada."
    },
    "Carnor Jax": {
      ship: "Interceptor TIE",
      text: "Las naves enemigas que tengas a alcance 1 no pueden realizar acciones de Concentración o Evasión, y tampoco pueden gastar fichas de Concentración ni de Evasión."
    },
    "GR-75 Medium Transport": {
      name: "Transporte mediano GR-75",
      ship: "Transporte mediano GR-75"
    },
    "Bandit Squadron Pilot": {
      name: "Piloto del escuadrón Bandido",
      ship: "Z-95 Cazacabezas"
    },
    "Tala Squadron Pilot": {
      name: "Piloto del escuadrón Tala",
      ship: "Z-95 Cazacabezas"
    },
    "Lieutenant Blount": {
      name: "Teniente Blount",
      text: "Cuando ataques, el defensor es alcanzado por tu ataque, incluso aunque no sufra ningún daño.",
      ship: "Z-95 Cazacabezas"
    },
    "Airen Cracken": {
      name: "Airen Cracken",
      text: "Después de que realices un ataque, puedes elegir otra nave aliada a alcance 1. Esa nave puede llevar a cabo 1 acción gratuita.",
      ship: "Z-95 Cazacabezas"
    },
    "Delta Squadron Pilot": {
      name: "Piloto del escuadrón Delta",
      ship: "Defensor TIE"
    },
    "Onyx Squadron Pilot": {
      name: "Piloto del escuadrón Ónice",
      ship: "Defensor TIE"
    },
    "Colonel Vessery": {
      name: "Coronel Vessery",
      text: "Cuando ataques, inmediatamente después de tirar los dados de ataque puedes fijar al defensor como blanco si éste ya tiene asignada una ficha de Blanco Fijado.",
      ship: "Defensor TIE"
    },
    "Rexler Brath": {
      text: "Después de que efectúes un ataque que inflinja al menos 1 carta de Daño al defensor, puedes gastar 1 ficha de Concentración para poner esas cartas boca arriba.",
      ship: "Defensor TIE"
    },
    "Knave Squadron Pilot": {
      name: "Piloto del escuadrón Canalla",
      ship: "Ala-E"
    },
    "Blackmoon Squadron Pilot": {
      name: "Piloto del escuadrón Luna Negra",
      ship: "Ala-E"
    },
    "Etahn A'baht": {
      text: "Cuando una nave neemiga situada dentro de tu arco de fuego a alcance 1-3 se defienda, el atacante puede cambiar 1 de sus resultados %HIT% por 1 resultado %CRIT%.",
      ship: "Ala-E"
    },
    "Corran Horn": {
      text: "Puedes efectuar 1 ataque al comienzo de la fase Final, pero si lo haces no podrás atacar en la ronda siguiente.",
      ship: "Ala-E"
    },
    "Sigma Squadron Pilot": {
      name: "Piloto del escuadrón Sigma",
      ship: "TIE Fantasma"
    },
    "Shadow Squadron Pilot": {
      name: "Piloto del escuadrón Sombra",
      ship: "TIE Fantasma"
    },
    '"Echo"': {
      name: '"Eco"',
      text: "Cuando desactives tu camuflaje, debes usar la plantilla de maniobra (%BANKLEFT% 2) o la de (%BANKRIGHT% 2) en lugar de la plantilla (%STRAIGHT% 2).",
      ship: "TIE Fantasma"
    },
    '"Whisper"': {
      name: '"Susurro"',
      text: "Después de que efectúes un ataque que impacte, puedes asignar una ficha de Concentración a tu nave.",
      ship: "TIE Fantasma"
    },
    "CR90 Corvette (Fore)": {
      name: "Corbeta CR90 (Proa)",
      ship: "Corbeta CR90 (Proa)",
      text: "Cuando ataques con tu armamento principal, puedes gastar 1 de Energía para tirar 1 dado de ataque adicional."
    },
    "CR90 Corvette (Aft)": {
      name: "Corbeta CR90 (Popa)",
      ship: "Corbeta CR90 (Popa)"
    },
    "Wes Janson": {
      text: "Después de que efectúes un ataque, puedes eliminar 1 ficha de Concentración, Evasión o Blanco Fijado (azul) del defensor.",
      ship: "Ala-X"
    },
    "Jek Porkins": {
      text: "Cuando recibas una ficha de Tensión, puedes descartarla y tirar 1 dado de ataque. Si sacas %HIT%, esta nave recibe 1 carta de Daño boca abajo.",
      ship: "Ala-X"
    },
    '"Hobbie" Klivian': {
      text: "Cuando fijes un blanco o gastes una ficha de Blanco Fijado, puedes quitar 1 ficha de Tensión de tu nave.",
      ship: "Ala-X"
    },
    "Tarn Mison": {
      text: "Cuando una nave enemiga te declare como objetivo de un ataque, puedes fijar esa nave como blanco.",
      ship: "Ala-X"
    },
    "Jake Farrell": {
      text: "Después de que realices una acción de Concentración o te asignen una ficha de Concentración, puedes efectuar una acción gratuita de impulso o tonel volado.",
      ship: "Ala-A"
    },
    "Gemmer Sojan": {
      text: "Mientras te encuentres a alcance 1 de al menos 1 nave enemiga, tu Agilidad aumenta en 1.",
      ship: "Ala-A"
    },
    "Keyan Farlander": {
      text: "Cuando ataques, puedes quitarte 1 ficha de Tensión  para cambiar todos tus resultados %FOCUS% por %HIT%.",
      ship: "Ala-B"
    },
    "Nera Dantels": {
      text: "Puedes efectuar ataques con armamentos secundarios %TORPEDO% contra naves enemigas fuera de tu arco de fuego.",
      ship: "Ala-B"
    },
    "Wild Space Fringer": {
      name: "Fronterizo del Espacio Salvaje",
      ship: "YT-2400"
    },
    "Dash Rendar": {
      text: "Puedes ignorar obstáculos durante la fase de Activación y al realizar acciones."
    },
    '"Leebo"': {
      text: "Cuando recibas una carta de Daño boca arriba, roba 1 carta de Daño adicional, resuelve 1 de ellas a tu elección y descarta la otra."
    },
    "Eaden Vrill": {
      text: "Si efectúas un ataque con un armamento principal contra una nave que tenga fichas de Tensión, tiras 1 dado de ataque adicional."
    },
    "Patrol Leader": {
      name: "Jefe de Patrulla",
      ship: "VT-49 Diezmador"
    },
    "Rear Admiral Chiraneau": {
      name: "Contralmirante Chiraneau",
      text: "Cuando atacas a alcance 1-2, puedes cambiar 1 de tus resultados de %FOCUS% por un resultado %CRIT%.",
      ship: "VT-49 Diezmador"
    },
    "Commander Kenkirk": {
      ship: "VT-49 Diezmador",
      text: "Si no te quedan escudos y tienes asignada al menos 1 carta de Daño, tu Agilidad aumenta en 1."
    },
    "Captain Oicunn": {
      name: "Capitán Oicunn",
      text: "Después de ejecutar un maniobra, toda nave enemiga con la que estés en contacto sufre 1 daño.",
      ship: "VT-49 Diezmador"
    },
    "Black Sun Enforcer": {
      name: "Ejecutor del Sol Negro",
      ship: "Víbora Estelar"
    },
    "Black Sun Vigo": {
      name: "Vigo del Sol Negro",
      ship: "Víbora Estelar"
    },
    "Prince Xizor": {
      name: "Príncipe Xizor",
      text: "Cuando te defiendas, una nave aliada que tengas a alcance 1 puede sufrir en tu lugar 1 resultado %HIT% o %CRIT% no anulado.",
      ship: "Víbora Estelar"
    },
    "Guri": {
      text: "Al comienzo de la fase de Combate, si tienes alguna nave enemiga a alcance 1 puedes asignar 1 ficha de Concentración a tu nave.",
      ship: "Víbora Estelar"
    },
    "Cartel Spacer": {
      name: "Agente del Cartel",
      ship: "Interceptor M3-A"
    },
    "Tansarii Point Veteran": {
      name: "Veterano de Punto Tansarii",
      ship: "Interceptor M3-A"
    },
    "Serissu": {
      text: "Cuando otra nave aliada situada a alcance 1 se defienda, puede volver a tirar 1 dado de defensa.",
      ship: "Interceptor M3-A"
    },
    "Laetin A'shera": {
      text: "Después de que te hayas defendido de un ataque, si el ataque no impactó, puedes asignar 1 ficha de Evasión a tu nave.",
      ship: "Interceptor M3-A"
    },
    "IG-88A": {
      text: "Después de que efectúes un ataque que destruya al defensor, puedes recuperar 1 ficha de Escudos.",
      ship: "Agresor"
    },
    "IG-88B": {
      text: "Una vez por ronda, después de que efectúes un ataque y lo falles, puedes efectuar un ataque con un sistema de armamento secundario %CANNON% que tengas equipado.",
      ship: "Agresor"
    },
    "IG-88C": {
      text: "Después de que realices una acción de impulso, puedes llevar a cabo una acción gratuita de Evasión.",
      ship: "Agresor"
    },
    "IG-88D": {
      text: "Puedes ejecutar la maniobra (%SLOOPLEFT% 3) o (%SLOOPRIGHT% 3) utilizando la plantilla (%TURNLEFT% 3) o (%TURNRIGHT% 3) correspondiente.",
      ship: "Agresor"
    },
    "Mandalorian Mercenary": {
      name: "Mercenario Mandaloriano"
    },
    "Boba Fett (Scum)": {
      text: "Cuando ataques o te defiendas, puedes volver a tirar 1 de tus dados por cada nave enemiga que tengas a alcance 1."
    },
    "Kath Scarlet (Scum)": {
      text: "Cuando ataques una nave que esté dentro de tu arco de fuego auxiliar, tira 1 dado de ataque adicional."
    },
    "Emon Azzameen": {
      text: "Cuando sueltes una bomba, puedes utilizar la plantilla de maniobra [%TURNLEFT% 3], [%STRAIGHT% 3] o [%TURNRIGHT% 3] en vez de la plantilla de [%STRAIGHT% 1]."
    },
    "Kavil": {
      ship: "Ala-Y",
      text: "Cuando ataques una nave que esté fuera de tu arco de fuego, tira 1 dado de ataque adicional."
    },
    "Drea Renthal": {
      ship: "Ala-Y",
      text: "Después de gastar una ficha de Blanco Fijado, puedes recibir 1 ficha de Tensión para fijar un blanco."
    },
    "Syndicate Thug": {
      name: "Esbirro del sindicato",
      ship: "Ala-Y"
    },
    "Hired Gun": {
      name: "Piloto de fortuna",
      ship: "Ala-Y"
    },
    "Spice Runner": {
      name: "Traficante de Especia",
      ship: "HWK-290"
    },
    "Dace Bonearm": {
      text: "Cuando una nave enemiga a alcance 1-3 reciba como mínimo 1 ficha de iones, si no tienes fichas de Tensión puedes recibir 1 ficha de Tensión para que esa nave sufra 1 de daño.",
      ship: "HWK-290"
    },
    "Palob Godalhi": {
      text: "Al comienzo de la fase de Combate, puedes quitar 1 ficha de Concentración o Evasión de una nave enemiga a alcance 1-2 y asignar esa ficha a tu nave."
    },
    "Torkil Mux": {
      text: "Al final de la fase de Activación, elige 1 nave enemiga a alcance 1-2. Hasta el final de la fase de Combate, se considera que el piloto de esa nave tiene Habilidad 0."
    },
    "Binayre Pirate": {
      name: "Pirata Binayre",
      ship: "Z-95 Cazacabezas"
    },
    "Black Sun Soldier": {
      name: "Sicario del Sol Negro",
      ship: "Z-95 Cazacabezas"
    },
    "N'Dru Suhlak": {
      text: "Cuando ataques, si no tienes ninguna otra nave aliada a alcance 1-2, tira 1 dado de ataque adicional.",
      ship: "Z-95 Cazacabezas"
    },
    "Kaa'To Leeachos": {
      text: "Al comienzo de la fase de Combate, puedes quitar 1 ficha de Concentración o Evasión de otra nave aliada que tengas a alcance 1-2 y asignar esa ficha a tu nave.",
      ship: "Z-95 Cazacabezas"
    },
    "Commander Alozen": {
      name: "Comandante Alozen",
      ship: "TIE Avanzado",
      text: "Al comienzo de la fase de Combate, puedes fijar como blanco una nave enemiga que tengas a alcance 1."
    },
    "Juno Eclipse": {
      ship: "TIE Avanzado",
      text: "Cuando reveles tu maniobra, puedes incrementar o reducir en 1 la velocidad de la maniobra (hasta un mínimo de 1)."
    },
    "Zertik Strom": {
      ship: "TIE Avanzado",
      text: "Las naves enemigas que tengas a alcance 1 no pueden aplicar su modificador al combate por alcance cuando ataquen."
    },
    "Lieutenant Colzet": {
      name: "Teniente Colzet",
      ship: "TIE Avanzado",
      text: "Al comienzo de la fase Final, puedes gastar una de tus fichas de Blanco fijado asignadas a una nave enemiga para seleccionar al azar y poner boca arriba 1 carta de Daño que esa nave tenga asignada boca abajo."
    },
    "Latts Razzi": {
      text: "Cuando una nave aliada declare un ataque, puedes gastar una ficha de Blanco Fijado que hayas asignado al defensor para reducir su Agilidad en 1 contra el ataque declarado."
    },
    "Miranda Doni": {
      ship: 'Ala-K',
      text: "Una vez por ronda, cuando ataques, puedes elegir entre gastar 1 de Escudos para tirar 1 dado de ataque adicional <strong>o bien</strong> tirar 1 dado de ataque menos para recuperar 1 de Escudos."
    },
    "Esege Tuketu": {
      ship: 'Ala-K',
      text: "Cuando otra nave aliada que tengas a alcance 1-2 esté atacando, puede usar tus fichas de Concentración."
    },
    "Guardian Squadron Pilot": {
      name: "Piloto del Escuadrón Guardián",
      ship: 'Ala-K'
    },
    "Warden Squadron Pilot": {
      name: "Piloto del Escuadrón Custodio",
      ship: 'Ala-K'
    },
    '"Redline"': {
      name: '"Velocidad Terminal"',
      ship: 'Castigador TIE',
      text: "Puedes mantener 2 blancos fijados sobre una misma nave. Cuando fijes un blanco, puedes fijar la misma nave como blanco por segunda vez."
    },
    '"Deathrain"': {
      name: '"Lluvia de Muerte"',
      ship: 'Castigador TIE',
      text: "Cuando sueltes una bomba, puedes usar los salientes frontales de la peana de tu nave. Puedes realizar una acción gratuita de tonel volado después de soltar una bomba."
    },
    'Black Eight Squadron Pilot': {
      name: "Piloto del Escuadrón Ocho Negro",
      ship: 'Castigador TIE'
    },
    'Cutlass Squadron Pilot': {
      name: "Piloto del Escuadrón Alfanje",
      ship: 'Castigador TIE'
    },
    "Moralo Eval": {
      text: "Puedes efectuar ataques con sistemas de armamento secundarios %CANNON% contra naves que estén dentro de tu arco de fuego auxiliar."
    },
    'Gozanti-class Cruiser': {
      text: "After you execute a maneuver, you may deploy up to 2 attached ships."
    },
    '"Scourge"': {
      name: "Azote",
      ship: "Caza TIE",
      text: "Cuando ataques a un defensor que tiene 1 o más cartas de Daño, tira 1 dado de ataque adicional."
    },
    "The Inquisitor": {
      text: "When attacking with your primary weapon at Range 2-3, treat the range of the attack as Range 1."
    },
    "Zuckuss": {
      text: "When attacking, you may roll 1 additional attack die.  If you do, the defender rolls 1 additional defense die."
    },
    "Dengar": {
      text: "Once per round after defending, if the attacker is inside your firing arc, you may perform an attack against the that ship."
    },
    "Talonbane Cobra": {
      ship: "Caza Kihraxz",
      text: "Cuando ataques o te defiendas, duplica el efecto de tus bonificaciones al combate por alcance."
    },
    "Graz the Hunter": {
      name: "Graz el Cazador",
      ship: "Caza Kihraxz",
      text: "Cuando te defiendas, tira 1 dado de defensa adicional si el atacante está situado dentro de tu arco de fuego."
    },
    "Black Sun Ace": {
      name: "As del Sol Negro",
      ship: "Caza Kihraxz"
    },
    "Cartel Marauder": {
      name: "Salteador del Cartel",
      ship: "Caza Kihraxz"
    },
    "Trandoshan Slaver": {
      name: "Esclavista Trandoshano",
      ship: "YV-666"
    },
    "Bossk": {
      ship: "YV-666",
      text: "Cuando realices un ataque con éxito, antes de inflingir el daño puedes anular 1 de tus resultados %CRIT% para añadir 2 resultados %HIT%."
    },
    "Poe Dameron": {
      ship: "T-70 Ala-X",
      text: "Cuando ataques o te defiendas, si tienes una ficha de Concentración, puedes cambiar 1 de tus resultados %FOCUS% por un resultado %HIT% o %EVADE%."
    },
    '"Blue Ace"': {
      name: '"As Azul"',
      ship: "T-70 Ala-X",
      text: "Cuando realices una acción de impulso, puedes utilizar la plantilla de maniobra (%TURNLEFT% 1) o (%TURNRIGHT% 1)."
    },
    "Red Squadron Veteran": {
      name: "Veterano del Esc. Rojo",
      ship: "T-70 Ala-X"
    },
    "Blue Squadron Novice": {
      name: "Novato del Esc. Azul",
      ship: "T-70 Ala-X"
    },
    '"Red Ace"': {
      name: "As Rojo",
      ship: "T-70 Ala-X",
      text: 'La primera vez que quites una ficha de Escudos de tu nave en cada ronda, asigna 1 ficha de Evasión a tu nave.'
    },
    '"Omega Ace"': {
      name: '"As Omega"',
      ship: "Caza TIE/fo",
      text: "Cuando ataques a un defensor que has fijado como blanco, puedes gastar las fichas de Blanco Fijado y una ficha de Concentración para cambiar todos tus resultados de dados por resultados %CRIT%."
    },
    '"Epsilon Leader"': {
      name: '"Jefe Epsilon"',
      ship: "Caza TIE/fo",
      text: "Al comienzo de la fase de Combate, retira 1 ficha de Tensión de cada nave aliada que tengas a alcance 1."
    },
    '"Zeta Ace"': {
      name: '"As Zeta"',
      ship: "Caza TIE/fo",
      text: "Cuando realices una acción de tonel volado, puedes utilizar la plantilla de maniobra (%STRAIGHT% 2) en vez de la plantilla (%STRAIGHT% 1)."
    },
    "Omega Squadron Pilot": {
      name: "Piloto del Esc. Omega",
      ship: "Caza TIE/fo"
    },
    "Zeta Squadron Pilot": {
      name: "Piloto del Esc. Zeta",
      ship: "Caza TIE/fo"
    },
    "Epsilon Squadron Pilot": {
      name: "Piloto del Esc. Epsilon",
      ship: "Caza TIE/fo"
    },
    '"Omega Leader"': {
      name: "Jefe Omega",
      ship: "Caza TIE/fo",
      text: 'Las naves enemigas que tienes fijadas como blanco no pueden modificar ningún dado cuando te atacan o se defienden de tus ataques.'
    },
    'Hera Syndulla': {
      text: 'When you reveal a green or red maneuver, you may rotate your dial to another maneuver of the same difficulty.'
    },
    '"Youngster"': {
      name: "Pipiolo",
      ship: "Caza TIE",
      text: "Los Cazas TIE aliados que tengas a alcance 1-3 pueden realizar la acción de tu carta de Mejora %ELITE% equipada."
    },
    '"Wampa"': {
      ship: "Caza TIE",
      text: "Cuando ataques, puedes anular todos los resultados de los dados. Si anulas al menos un resultado %CRIT%, inflinge 1 carta de Daño boca abajo al defensor."
    },
    '"Chaser"': {
      name: "Perseguidor",
      ship: "Caza TIE",
      text: "Cuando otra nave aliada que tengas a alcance 1 gaste una ficha de Concentración, asigna 1 ficha de Concentración a tu nave."
    },
    'Ezra Bridger': {
      text: "When defending, if you are stressed, you may change up to 2 of your %FOCUS% results to %EVADE% results."
    },
    '"Zeta Leader"': {
      name: "Jefe Zeta",
      text: 'Cuando ataques, si no estás bajo tensión, puedes recibir 1 ficha de Tensión para tirar 1 dado de ataque adicional.',
      ship: "Caza TIE/fo"
    },
    '"Epsilon Ace"': {
      name: "As Epsilon",
      text: 'Mientras no tengas ninguna carta de Daño asignada, se considera que tienes Habilidad 12.',
      ship: "Caza TIE/fo"
    },
    "Kanan Jarrus": {
      text: "When an enemy ship at Range 1-2 is attacking, you may spend a focus token.  If you do, the attacker rolls 1 fewer attack die."
    },
    '"Chopper"': {
      text: "At the start of the Combat phase, each enemy ship you are touching receives 1 stress token."
    },
    'Hera Syndulla (Attack Shuttle)': {
      text: "When you reveal a green or red maneuver, you may rotate your dial to another maneuver of the same difficulty."
    },
    'Sabine Wren': {
      text: "Immediately before you reveal your maneuver, you may perform a free boost or barrel roll action."
    },
    '"Zeb" Orrelios': {
      text: 'When defending, you may cancel %CRIT% results before %HIT% results.'
    },
    'Tomax Bren': {
      text: 'Once per round, after you discard an %ELITE% Upgrade card, flip that card faceup.',
      ship: "Bombardero TIE"
    },
    'Ello Asty': {
      text: 'Mientras no estés bajo tensión, puedes ejecutar tus maniobras %TROLLLEFT% y %TROLLRIGHT% como maniobras blancas.',
      ship: "T-70 Ala-X"
    },
    "Valen Rudor": {
      text: "After defending, you may perform a free action."
    },
    "4-LOM": {
      text: "At the start of the End phase, you may assign 1 of your stress tokens to another ship at Range 1."
    },
    "Tel Trevura": {
      text: "The first time you would be destroyed, instead cancel any remaining damage, discard all Damage cards, and deal 4 facedown Damage cards to this ship."
    },
    "Manaroo": {
      text: "At the start of the Combat phase, you may assign all focus, evade, and target lock tokens assigned to you to another friendly ship."
    }
  };
  upgrade_translations = {
    "Ion Cannon Turret": {
      name: "Torreta de cañones de iones",
      text: "<strong>Ataque:</strong> Ataca 1 nave (aunque esté fuera de tu arco de fuego).<br /><br />Si este ataque impacta, el defensor sufre 1 punto de daño y recibe 1 ficha de Iones. Después se anulan todos los resultados de los dados."
    },
    "Proton Torpedoes": {
      name: "Torpedos de protones",
      text: "<strong>Ataque (Blanco Fijado):</strong> Gasta tu ficha de Blanco Fijado y descarta esta carta para efectuar este ataque.<br /><br />Puedes cambiar 1 de tus resultados %FOCUS% por un resultado %CRIT%."
    },
    "R2 Astromech": {
      name: "Droide Astromecánico R2",
      text: "Puedes ejecutar todas las maniobras de velocidad 1 y 2 como maniobras verdes."
    },
    "R2-D2": {
      text: "Después de que ejecutes una maniobra verde, puedes recuperar 1 ficha de Escudos (pero no puedes tener más fichas que tu valor de Escudos)."
    },
    "R2-F2": {
      text: "<strong>Acción:</strong> Tu valor de agilidad aumenta en 1 hasta el final de esta ronda de juego."
    },
    "R5-D8": {
      text: "<strong>Acción:</strong> Tira 1 dado de defensa.<br /><br />Si sacas %EVADE% o %FOCUS%, descarta 1 carta de Daño que tengas boca abajo."
    },
    "R5-K6": {
      text: "Después de gastar tu ficha de Blanco Fijado, tira 1 dado de defensa.<br /><br />Si sacas un resultado %EVADE% puedes volver a fijar la misma nave como blanco inmediatamente. No puedes gastar esta nueva ficha de Blanco Fijado durante este ataque."
    },
    "R5 Astromech": {
      name: "Droide Astromecánico R5",
      text: "Durante la fase Final, puedes elegir 1 de las cartas de Daño con el atributo <strong>Nave</strong> que tengas boca arriba, darle la vuelta y dejarla boca abajo."
    },
    "Determination": {
      name: "Determinación",
      text: "Cuando se te asigne una carta de Daño boca arriba que tenga el atributo <strong>Piloto</strong>, descártala inmediatamente sin resolver su efecto."
    },
    "Swarm Tactics": {
      name: "Táctica de Enjambre",
      text: "Al principio de la fase de Combate, elige 1 nave aliada que tengas a alcance 1.<br /><br />Hasta el final de esta fase, se considera que el valor de Habilidad de la nave elejida es igual que el tuyo."
    },
    "Squad Leader": {
      name: "Jefe de Escuadrón",
      text: "<strong>Acción:</strong> Elije una nave a alcance 1-2 cuyo pilioto tenga una Habilidad más baja que la tuya.<br /><br />La nave elegida puede llevar a cabo 1 acción gratuita de inmediato."
    },
    "Expert Handling": {
      name: "Pericia",
      text: "<strong>Acción:</strong> Realiza una acción gratuita de tonel volado. Si no tienes el icono de acción %BARRELROLL%, recibes una ficha de Tensión.<br /><br />Después puedes descartar una ficha enemiga de Blanco Fijado que esté asignada a tu nave."
    },
    "Marksmanship": {
      name: "Puntería",
      text: "<strong>Acción:</strong> Cuando ataques en esta ronda puedes cambiar 1 de tus resultados %FOCUS% por un resultado %CRIT% y tus demás resultados %FOCUS% por resultados %HIT%."
    },
    "Concussion Missiles": {
      name: "Misiles de Impacto",
      text: "<strong>Ataque (Blanco Fijado):</strong> Gasta tu ficha de Blanco Fijado y descarta esta carta para efectuar este ataque.<br /><br />Puedes cambiar 1 resultado de cara vacía por un resultado %HIT%."
    },
    "Cluster Missiles": {
      name: "Misiles de Racimo",
      text: "<strong>Ataque (Blanco Fijado):</strong> Gasta tu ficha de Blanco Fijado y descarta esta carta para efectuar este ataque <strong>dos veces</strong>."
    },
    "Daredevil": {
      name: "Temerario",
      text: "<strong>Acción:</strong> Ejecuta una maniobra blanca (%TURNLEFT% 1) o (%TURNRIGHT% 1) y luego recibe 1 ficha de Tensión.<br /><br />Después, si no tienes el ícono de acción %BOOST%, tira 2 dados de ataque y sufre todos los daños normales (%HIT%) y críticos (%CRIT%) obtenidos."
    },
    "Elusiveness": {
      name: "Escurridizo",
      text: "Cuando te defiendas en combate, puedes recibir 1 ficha de Tensión para elegir 1 dado de ataque. El atacante deberá volver a lanzar ese dado.<br /><br />No puedes usar esta habilidad si ya tienes una ficha de Tensión."
    },
    "Homing Missiles": {
      name: "Misiles Rastreadores",
      text: "<strong>Ataque (Blanco Fijado):</strong> Descarta esta carta para efectuar este ataque.<br /><br />El defensor no puede gastar fichas de evasión durante este ataque."
    },
    "Push the Limit": {
      name: "Máximo Esfuerzo",
      text: "Una vez por ronda, después de que realices una acción podras realizar a cabo 1 acción gratuita de entre las que figuren en tu barra de acciones.<br /><br />Después recibes 1 ficha de Tensión."
    },
    "Deadeye": {
      name: "Certero",
      text: "Puedes tratar la expresión <strong>\"Ataque (blanco fijado)\"</strong> como si dijera <strong>\"Ataque (concentración)\"</strong>.<br /><br />Cuando un ataque te obligue a gastar una ficha de Blanco Fijado, puedes gastar una ficha de Concentración en su lugar."
    },
    "Expose": {
      name: "Expuesto",
      text: "<strong>Acción:</strong> Hasta el final de la ronda, el valor de tu armamento principal se incrementa en 1 y tu Agilidad se reduce en 1."
    },
    "Gunner": {
      name: "Artillero",
      text: "Después de que efectúes un ataque y lo falles, puedes realizar inmediatamente un ataque con tu armamento principal.  No podrás realizar ningún otro ataque en esta misma ronda."
    },
    "Ion Cannon": {
      name: "Cañón de Iones",
      text: "<strong>Ataque:</strong> Ataca a 1 nave.<br /><br />Si este ataque impacta, el defensor sufre 1 de daño y recibe 1 ficha de Iones. Después se anulan <b>todos</b> los resultados de los dados."
    },
    "Heavy Laser Cannon": {
      name: "Cañón Laser Pesado",
      text: "<strong>Ataque:</strong> Ataca a 1 nave.<br /><br />Inmediatamente después de lanzar los dados de ataque, debes cambiar todos tus resultados %CRIT% por resultados %HIT%."
    },
    "Seismic Charges": {
      name: "Cargas Sísmicas",
      text: "Cuando reveles tu selector de maniobras, puedes descartar esta carta para <strong>soltar</strong> 1 ficha de Carga Sísmica.<br /><br />Esta ficha se <strong>detona</strong> al final de la fase de Activación."
    },
    "Mercenary Copilot": {
      name: "Copiloto Mercenario",
      text: "Cuando ataques a alcance 3, puedes cambiar 1 de tus resultados %HIT% por un resultado %CRIT%."
    },
    "Assault Missiles": {
      name: "Misiles de Asalto",
      text: "<strong>Ataque (Blanco Fijado):</strong> Gasta tu ficha de Blanco Fijado y descarta esta carta para efectuar este ataque.<br /><br />Si este ataque impacta al objetivo, toda otra nave que haya a alcance 1 del defensor sufre 1 daño."
    },
    "Veteran Instincts": {
      name: "Instinto de Veterano",
      text: "La Habilidad de tu piloto se incrementa en 2."
    },
    "Proximity Mines": {
      name: "Minas de Proximidad",
      text: "<strong>Acción:</strong> Descarta esta carta para <strong>soltar</strong> 1 ficha de Mina de Proximidad.<br /><br />Cuando la peana o la plantilla de maniobra de una nave se solape con esta ficha, ésta se <strong>detona</strong>."
    },
    "Weapons Engineer": {
      name: "Ingeniero de Armamento",
      text: "Puedes tener 2 Blancos Fijados a la vez (pero sólo 1 para cada nave enemiga).<br /><br />Cuando fijes un blanco, puedes fijar como blanco a dos naves distintas."
    },
    "Draw Their Fire": {
      name: "Atraer su fuego",
      text: "Cuando una nave aliada que tengas a alcance 1 sea alcanzada por un ataque, puedes sufrir tú 1 de sus resultados %CRIT% no anulados en vez de la nave objetivo."
    },
    "Luke Skywalker": {
      text: "Después de que efectúes un ataque y lo falles, realiza inmediatamente un ataque con tu armamento principal. Puedes cambiar 1 resultado %FOCUS% por 1 resultado %HIT%. No podrás realizar ningún otro ataque en esta misma ronda."
    },
    "Nien Nunb": {
      text: "Todas las maniobras %STRAIGHT% se consideran verdes para ti."
    },
    "Chewbacca": {
      text: "Cuando recibas una carta de Daño, puedes descartarla de inmediato y recuperar 1 de Escudos.<br /><br />Luego descarta esta carta de Mejora."
    },
    "Advanced Proton Torpedoes": {
      name: "Torpedos de protones avanzados",
      text: "<strong>Ataque (Blanco Fijado):</strong> Gasta tu ficha de Blanco Fijado y descarta esta carta para efectuar este ataque. Puedes cambiar hasta 3 resultados de caras vacías por resultados %FOCUS%."
    },
    "Autoblaster": {
      name: "Cañón Blaster Automático",
      text: "<strong>Ataque:</strong> Ataca a 1 nave.<br /><br />Tus resultados %HIT% no pueden ser anulados por los dados de defensa.<br /><br />El defensor puede anular tus resultados %CRIT% antes que los %HIT%."
    },
    "Fire-Control System": {
      name: "Sistema de Control de Disparo",
      text: "Después de que efectúes un ataque, puedes fijar al defensor como blanco."
    },
    "Blaster Turret": {
      name: "Torreta Bláster",
      text: "<strong>Ataque (Concentración):</strong> Gasta 1 ficha de Concentración para efectuar este ataque contra una nave (aunque esté fuera de tu arco de fuego)."
    },
    "Recon Specialist": {
      name: "Especialista en Reconocimiento",
      text: "Cuando realices una acción de Concentración, asigna 1 ficha de Concentración adicional a tu nave."
    },
    "Saboteur": {
      name: "Saboteador",
      text: "<strong>Acción:</strong> Elige 1 nave enemiga que tengas a alcance 1 y tira 1 dado de ataque. Si sacas %HIT% o %CRIT%, elige al azar 1 carta de Daño que esa nave tenga asignada boca abajo, dale la vuelta y resuélvela."
    },
    "Intelligence Agent": {
      name: "Agente del Servicio de Inteligencia",
      text: "Al comienzo de la fase de Activación, elige 1 nave enemiga que tengas a alcance 1-2. Puedes mirar el selector de maniobras de esa nave."
    },
    "Proton Bombs": {
      name: "Bombas de Protones",
      text: "Cuando reveles tu selector de maniobras, puedes descartar esta carta para <strong>soltar</strong> 1 ficha de Bombas de Protones.<br /><br />Esta ficha se <strong>detona</strong> al final de la fase de Activación."
    },
    "Adrenaline Rush": {
      name: "Descarga de Adrenalina",
      text: "Cuando reveles una maniobra roja, puedes descartar esta carta para tratarla como si fuera una maniobra blanca hasta el final de la fase de Activación."
    },
    "Advanced Sensors": {
      name: "Sensores Avanzados",
      text: "Inmediatamente antes de que reveles tu maniobra, puedes realizar 1 acción gratuita.<br /><br />Si utilizas esta capacidad, debes omitir tu paso de \"Realizar una acción\" durante esta ronda."
    },
    "Sensor Jammer": {
      name: "Emisor de Interferencias",
      text: "Cuando te defiendas, puedes cambiar 1 de los resultados %HIT% por uno %FOCUS%.<br /><br />El atacante no puede volver a lanzar el dado cuyo resultado hayas cambiado."
    },
    "Darth Vader": {
      text: "Después de que ataques a una nave enemiga, puedes sufrir 2 de daño para que esa nave reciba 1 de daño crítico."
    },
    "Rebel Captive": {
      name: "Prisionero Rebelde",
      text: "Una vez por ronda, la primera nave que te declare como objetivo de un ataque recibe inmediatamente 1 ficha de Tensión."
    },
    "Flight Instructor": {
      name: "Instructor de Vuelo",
      text: "Cuando te defiendas, puedes volver a tirar 1 dado en el que hayas sacado %FOCUS%. Si la Habilidad del piloto atacante es de 2 o menos, puedes volver a tirar 1 dado en el que hayas sacado una cara vacía."
    },
    "Navigator": {
      name: "Oficial de Navegación",
      text: "Cuando reveles una maniobra, puedes rotar el selector para escoger otra maniobra que tenga la misma dirección.<br /><br />Si tienes alguna ficha de Tensión, no puedes rotar el selector para escoger una maniobra roja."
    },
    "Opportunist": {
      name: "Oportunista",
      text: "Cuando ataques, si el defensor no tiene fichas de Concentración o de Evasión, puedes recibir 1 ficha de Tensión para tirar 1 dado de ataque adicional.<br /><br />No puedes utilizar esta capacidad si tienes fichas de Tensión."
    },
    "Comms Booster": {
      name: "Amplificador de Comunicaciones",
      text: "<strong>Energía:</strong> Gasta 1 de Energía para descartar todas las fichas de Tensión de una nave aliada que tengas a alcance at Range 1-3. Luego asigna 1 ficha de Concentración a esa nave."
    },
    "Slicer Tools": {
      name: "Sistemas de Guerra Electrónica",
      text: "<strong>Acción:</strong> Elige 1 o mas naves enemigas situadas a alcance 1-3 y que tengan fichas de Tensión. Por cada nave elegida, puedes gastar 1 de Energía para que esa nave sufra 1 daño."
    },
    "Shield Projector": {
      name: "Proyector de Escudos",
      text: "Cuando una nave enemiga pase a ser la nave activa durante la fase de Combate, puedes gastar 3 de Energía para obligar a esa nave a atacarte (si puede) hasta el final de la fase."
    },
    "Ion Pulse Missiles": {
      name: "Misiles de Pulso Iónico",
      text: "<strong>Ataque (Blanco Fijado):</strong> Descarta esta carta para efectuar este ataque.<br /><br />Si este ataque impacta, el defensor sufre 1 daño y recibe 2 fichas de Iones. Después se anulan <strong>todos</strong> los resultados de los dados."
    },
    "Wingman": {
      name: "Nave de Escolta",
      text: "Al comienzo de la fase de Combate, quita 1 ficha de tensión de otra nave aliada que tengas a alcance 1."
    },
    "Decoy": {
      name: "Señuelo",
      text: "Al comienzo de la fase de Combate, puedes elegir 1 nave aliada que tengas a alcance 1-2. Intercambia tu Habilidad de piloto por la Habilidad de piloto de esa nave hasta el final de la fase."
    },
    "Outmaneuver": {
      name: "Superioridad Táctica",
      text: "Cuando ataques a una nave situada dentro de tu arco de fuego, si tú no estás dentro del arco de fuego de esa nave, su Agilidad se reduce en 1 (hasta un mínimo de 0)."
    },
    "Predator": {
      name: "Depredador",
      text: "Cuando ataques, puedes volver a tirar 1 dado de ataque. Si la Habilidad del piloto defensor es 2 o menor, en vez de eso puedes volver a tirar hasta 2 dados de ataque."
    },
    "Flechette Torpedoes": {
      name: "Torpedos de Fragmentación",
      text: "<strong>Ataque (Blanco Fijado):</strong> Gasta tu ficha de Blanco Fijado y descarta esta carta para efectuar este ataque.<br /><br />Después de que realices este ataque, el defensor recibe 1 ficha de Tensión si su Casco es de 4 o inferior."
    },
    "R7 Astromech": {
      name: "Droide Astromecánico R7",
      text: "Una vez por ronda cuando te defiendas, si tienes al atacante fijado como blanco, puedes gastar esa ficha de Blanco Fijado para elegir algunos o todos sus dados de ataque. El atacante debe volver a tirar los dados que hayas elegido."
    },
    "R7-T1": {
      name: "R7-T1",
      text: "<strong>Acción:</strong> Elije 1 nave enemiga a alcance 1-2. Si te encuentras dentro de su arco de fuego, puedes fijarla como blanco. Después puedes realizar una acción gratuita de impulso."
    },
    "Tactician": {
      name: "Estratega",
      text: "Después de que efectúes un ataque contra una nave que esté situada dentro de tu arco de fuego a alcance 2, esa nave recibe 1 ficha de Tensión."
    },
    "R2-D2 (Crew)": {
      name: "R2-D2 (Tripulante)",
      text: "Al final de la fase Final, si no tienes Escudos, puedes recuperar 1 de Escudos y tirar 1 dado de ataque. Si sacas %HIT%, pon boca arriba 1 de las cartas de Daño que tengas boca abajo (elegida al azar) y resuélvela."
    },
    "C-3PO": {
      name: "C-3PO",
      text: "Una vez por ronda, antes de que tires 1 o mas dados de defensa, puedes decir en voz alta cuántos resultados %EVADE% crees que vas a sacar. Si aciertas (antes de modificar los dados), añade 1 %EVADE% al resultado."
    },
    "Single Turbolasers": {
      name: "Batería de Turboláseres",
      text: "<strong>Ataque (Energía):</strong> Gasta 2 de Energía de esta carta para efectuar este ataque. La Agilidad del defensor se duplica contra este ataque. Puedes cambiar 1 de tus resultados de  %FOCUS% por 1 resultado de %HIT%."
    },
    "Quad Laser Cannons": {
      name: "Cañones Láser Cuádruples",
      text: "<strong>Ataque (Energía):</strong> Gasta 1 de Energía de esta carta para efectuar este ataque. Si no impacta, puedes gastar inmediatamente 1 de Energía de esta carta para repetir el ataque."
    },
    "Tibanna Gas Supplies": {
      name: "Suministro de Gas Tibanna",
      text: "<strong>Energía:</strong> Puedes descartar esta carta para obtener 3 de Energía."
    },
    "Ionization Reactor": {
      name: "Reactor de Ionización",
      text: "<strong>Energía:</strong> Gasta 5 de Energía de esta carta y descártala para para que todas las demás naves situadas a alcance 1 sufran 1 de daño y reciban 1 ficha de Iones."
    },
    "Engine Booster": {
      name: "Motor Sobrepotenciado",
      text: "Immediatamente antes de revelar tu selector de maniobras, puedes gastar 1 de Energía para ejecutar 1 maniobra blanca de (%STRAIGHT% 1). No puedes usar esta capacidad si al hacerlo te solapas con otra nave."
    },
    "R3-A2": {
      name: "R3-A2",
      text: "Cuando declares al objetivo de tu ataque, si el defensor está dentro de tu arco de fuego, puedes recibir 1 ficha de Tensión para hacer que el defensor reciba 1 ficha de Tensión."
    },
    "R2-D6": {
      name: "R2-D6",
      text: "Tu barra de mejoras gana el icono de mejora %ELITE%.<br /><br />No puedes equiparte esta mejora si ya tienes un icono de mejora %ELITE% o si la Habilidad de de tu piloto es de 2 o menos."
    },
    "Enhanced Scopes": {
      name: "Radar Mejorado",
      text: "La Habilidad de tu piloto se considera 0 durante la fase de Activación."
    },
    "Chardaan Refit": {
      name: "Reequipado en Chardaan",
      ship: "Ala-A",
      text: "<span class=\"card-restriction\">Solo Ala-A.</span><br /><br />Esta carta tiene un coste negativo en puntos de escuadrón."
    },
    "Proton Rockets": {
      name: "Cohetes de Protones",
      text: "<strong>Ataque (Concentración):</strong> Descarta esta carta para efectuar este ataque.<br /><br />Puedes tirar tantos dados de ataque adicionales como tu puntuación de Agilidad, hasta un máximo de 3 dados adicionales."
    },
    "Kyle Katarn": {
      text: "Despues de que quites una ficha de Tensión de tu nave, puedes asiganar una ficha de Concentración a tu nave."
    },
    "Jan Ors": {
      text: "Una vez por ronda, cuando una nave aliada que tengas a alcance 1-3 realice una accion de Concentración o vaya a recibir una ficha de Concentración, en vez de eso puedes asignarle a esa nave una ficha de Evasión."
    },
    "Toryn Farr": {
      text: "<strong>Acción:</strong> Gasta cualquier cantidad de Energía para elegir ese mismo número de naves enemigas que tengas a alcance 1-2. Descarta todas las fichas de Concentración, Evasión y Blanco Fijado (azules) de las naves elegidas."
    },
    "R4-D6": {
      name: "R4-D6",
      text: "Cuando seas alcanzado por un ataque y haya al menos 3 resultados %HIT% sin anular, puedes anular todos los que quieras hasta que solo queden 2.  Recibes 1 ficha de Tensión por cada resultado que anules de este modo."
    },
    "R5-P9": {
      name: "R5-P9",
      text: "Al final de la fase de Combate, puedes gastar 1 de tus fichas de Concentración para recuperar 1 ficha de Escudos (hasta un máximo igual a tu puntuación de Escudos)."
    },
    "WED-15 Repair Droid": {
      name: "Droide de Reparaciones WED-15",
      text: "<strong>Acción:</strong> Gasta 1 de Energia para descartar 1 carta de Daño que tengas boca abajo, o bien gasta 3 de Energía para descartar 1 carta de Daño que tengas boca arriba."
    },
    "Carlist Rieekan": {
      name: "Carlist Rieekan",
      text: "Al pincipio de la fase de Activación, puedes descartar esta carta para que la Habilidad de todas tus naves se considere 12 hasta el final de la fase."
    },
    "Jan Dodonna": {
      name: "Jan Dodonna",
      text: "Cuando otra nave aliada que tengas a alcance 1 efectúe un ataque, podrá cambiar 1 de sus resultados de %HIT% por 1 resultado de %CRIT%."
    },
    "Expanded Cargo Hold": {
      name: "Bodega de Carga Ampliada",
      text: "<span class=\"card-restriction\">Solo GR-75</span><br /><br />Una vez por ronda, cuando tengas que recibir una carta de Daño boca arriba, puedes robar esa carta del mazo de Daño de proa o del mazo de Daño de popa.",
      ship: 'Transporte mediano GR-75'
    },
    "Backup Shield Generator": {
      name: "Generador de Escudos Auxiliar",
      text: "Al final de cada ronda, puedes gastar 1 de Energía para recuperar 1 de Escudos (hasta el maximo igual a tu puntuación de Escudos)."
    },
    "EM Emitter": {
      name: "Emisor de señal Electromagnética",
      text: "Cuando obstruyas un ataque, el defensor tira 3 dados de defensa adicionales en vez de 1."
    },
    "Frequency Jammer": {
      name: "Inhibidor de Frecuencias",
      text: "Cuando lleves a cabo una acción de intereferencia, elige 1 nave enemiga que no tenga fichas de Tensión y se encuentre a alcance 1 de la nave interferida. La nave elegida recibe una ficha de Tension."
    },
    "Han Solo": {
      name: "Han Solo",
      text: "Cuando ataques, si tienes la defensor fijado como blanco, puedes gastar esa ficha de Blanco Fijado para cambiar todos tus resultados de %FOCUS% por resultados de %HIT%."
    },
    "Leia Organa": {
      name: "Leia Organa",
      text: "Al comienzo de la fase de Activación, puedes descartar esta carta para que todas las naves aliadas que muestren una maniobra roja seleccionada la traten como si fuera una maniobra blanca hasta el final de la fase."
    },
    "Raymus Antilles": {
      name: "Raymus Antilles",
      text: "Al comiuenzo de la fase de Activación, elige 1 nave enemiga que tengas a alcance 1-3. Puedes mirar su selector de maniobras. Si ha seleccionado una maniobra blanca, adjudica 1 ficha de Tensión a esa nave."
    },
    "Gunnery Team": {
      name: "Dotación de Artillería",
      text: "Una vez por ronda, cuando ataques con un armamento secudario, puedes gastar 1 de Energía para cambiar 1 cara de dado vacía por 1 resultado de %HIT%."
    },
    "Sensor Team": {
      name: "Equipo de Control de Sensores",
      text: "Cuando fijes un blanco, puedes fijar como blanco una nave enemiga a alcance 1-5 (en lugar de 1-3)."
    },
    "Engineering Team": {
      name: "Equipo de Ingeniería",
      text: "Durante la fase de Activación, si enseñas una maniobra %STRAIGHT%, recibes 1 de Energía adicional durante el paso de \"Obtener Energía\"."
    },
    "Lando Calrissian": {
      name: "Lando Calrissian",
      text: "<strong>Acción:</strong> Tira 2 dados de defensa. Por cada %FOCUS% que saques, asigna 1 ficha de Concentración a tu nave. Por cada resultado de %EVADE% que saques, asigna 1 ficha de Evasión a tu nave."
    },
    "Mara Jade": {
      name: "Mara Jade",
      text: "Al final de la fase de Combate, toda nave enemiga situada a alcance 1 que no tenga 1 ficha de Tensión recibe 1 ficha de Tensión."
    },
    "Fleet Officer": {
      name: "Oficial de Flota",
      text: "<strong>Acción:</strong> Elige un máximo de 2 naves aliadas que tengas a alcance 1-2 y asigna 1 ficha de Concentración a cada una de ellas. Luego recibes 1 ficha de Tensión."
    },
    "Lone Wolf": {
      name: "Lobo solitario",
      text: "Cuando ataques o defiendas, si no tienes ninguna nave aliada a alcance 1-2, pues volver a tirar 1 dado en el que hayas sacado una cara vacía."
    },
    "Stay On Target": {
      name: "Seguir el Objetivo",
      text: "Cuando reveles una maniobra, puedes girar tu selector para escoger otra maniobra que tenga la misma velocidad.<br /><br />Esa maniobra se considera roja."
    },
    "Dash Rendar": {
      text: "Puedes efectuar ataques mientras estés solapado con un obstáculo.<br /><br />Tus ataques no pueden ser obstruidos."
    },
    '"Leebo"': {
      text: "<strong>Acción:</strong> Realiza una acción gratuita de Impulso. Después recibes 1 marcador de Iones."
    },
    "Ruthlessness": {
      name: "Crueldad",
      text: "Después de que efectúes un ataque que impacte, <strong>debes</strong> elegir otra nave situada a alcance 1 del defensor (exceptuando la tuya). Esa nave sufre 1 daño."
    },
    "Intimidation": {
      name: "Intimidación",
      text: "Mientras estes en contacto con una nave enemiga, la Agilidad de esa nave se reduce en 1."
    },
    "Ysanne Isard": {
      text: "Al comienzo de la fase de Combate, si no te quedan Escudos y tu nave tiene asignada al menos 1 carta de Daño, puedes realizar una acción gratuita de Evasión."
    },
    "Moff Jerjerrod": {
      text: "Cuando recibas una carta de Daño boca arriba, puedes descartar esta carta de Mejora u otra carta de %CREW% para poner boca abajo esa carta de Daño sin resolver su efecto."
    },
    "Ion Torpedoes": {
      name: "Torpedos de Iones",
      text: "<strong>Ataque (Blanco Fijado):</strong> Gasta tu ficha de Blanco Fijado y descarta esta carta para efectuar este ataque.<br /><br />Si este ataque impacta, el defensor y toda nave que esté a alcance 1 reciben 1 ficha de Iones cada una."
    },
    "Bomb Loadout": {
      name: "Compartimento de Bombas",
      text: "<span class=\"card-restriction\">Solo ala-Y.</span><br /><br />Tu barra de mejoras gana el icono %BOMB%.",
      ship: "Ala-Y"
    },
    "Bodyguard": {
      name: "Guardaespaldas",
      text: "%SCUMONLY%<br /><br />Al principio de la fase de Combate, puedes gastar 1 ficha de Concentración para elegir 1 nave aliada situada a alcance 1 cuyo piloto tenga una Habilidad más alta que la tuya. Hasta el final de la ronda, la puntuación de Agilidad de esa nave se incrementa en 1."
    },
    "Calculation": {
      name: "Planificación",
      text: "Cuando ataques, puedes gastar 1 ficha de Concentración para cambiar 1 de tus resultados %FOCUS% por un resultado %CRIT%."
    },
    "Accuracy Corrector": {
      name: "Corrector de Puntería",
      text: "Cuando ataques, puedes anular los resultados de todos tus dados. Después puedes añadir 2 resultados %HIT%.<br /><br />Si decides hacerlo, no podrás volver a modificar tus dados durante este ataque."
    },
    "Inertial Dampeners": {
      name: "Amortiguadores de Inercia",
      text: "Cuando reveles tu maniobra, puedes descartar esta carta para ejecutar en su lugar una maniobra blanca [0%STOP%]. Después recibes 1 ficha de Tensión."
    },
    "Flechette Cannon": {
      name: "Cañón de Fragmentación",
      text: "<strong>Ataque:</strong> Ataca a 1 nave.%LINEBREAK%Si este ataque impacta, el defensor sufre 1 de daño y, si no tiene asignada ninguna ficha de Tensión, recibe también 1 ficha de Tensión. Después se anulan <strong>todos</strong> los resultados de los dados."
    },
    '"Mangler" Cannon': {
      name: 'Cañón "Mutilador"',
      text: "<strong>Ataque:</strong> Ataca a 1 nave.%LINEBREAK%Durante este ataque, puedes cambiar 1 de tus resultados %HIT% por un resultado %CRIT%."
    },
    "Dead Man's Switch": {
      name: "Dispositivo de Represalia",
      text: "Cuando seas destruido, toda nave que tengas a alcance 1 sufre 1 daño."
    },
    "Feedback Array": {
      name: "Transmisor de Sobrecargas",
      text: "Durante la fase de Combate, en vez de efectuar ataques, puedes recibir 1 ficha de Iones y sufrir 1 daño para elegir 1 nave enemiga a alcance 1. Esa nave sufre 1 daño."
    },
    '"Hot Shot" Blaster': {
      name: "Cañón Bláster Desechable",
      text: "<strong>Ataque:</strong> Descarta esta carta para atacar a 1 nave (aunque esté fuera de tu arco de fuego)."
    },
    "Greedo": {
      text: "%SCUMONLY%<br /><br />La primera vez que ataques cada ronda y la primera vez que te defiendas cada ronda, la primera carta de Daño inflingida será asignada boca arriba."
    },
    "Outlaw Tech": {
      name: "Técnico Clandestino",
      text: "%SCUMONLY%<br /><br />Después de que ejecutes una maniobra roja, puedes asignar 1 ficha de Concentración a tu nave."
    },
    "K4 Security Droid": {
      name: "Droide de Seguridad K4",
      text: "%SCUMONLY%<br /><br />Después de que ejecutes una maniobra verde, puedes fijar un blanco."
    },
    "Salvaged Astromech": {
      name: "Droide Astromecánico Remendado",
      text: "Cuando recibas una carta de Daño con el atributo <strong>Nave</strong>, puedes descartarla de inmediato (antes de resolver sus efectos).<br /><br />Luego descarta esta carta de Mejora."
    },
    '"Genius"': {
      name: '"Genio"',
      text: "Si estás equipado con una bomba que puede soltarse antes de revelar tu selector de maniobras, puedes elegir soltar la bomba <strong>después</strong> de ejecutar tu maniobra."
    },
    "Unhinged Astromech": {
      name: "Droide Astromecánico Desquiciado",
      text: "Puedes ejecutar todas las maniobras de velocidad 3 como maniobras verdes."
    },
    "R4 Agromech": {
      name: "Droide Agromecánico R4",
      text: "Cuando ataques, después de gastar una ficha de Concentración puedes fijar al defensor como blanco."
    },
    "R4-B11": {
      text: "Cuando ataques, si tienes al defensor fijado como blanco, puedes gastar la ficha de Blanco Fijado para elegir cualquier o todos sus dados de defensa. El defensor debe volver a tirar los dados elegidos."
    },
    "Autoblaster Turret": {
      name: "Torreta de Bláster Automático",
      text: "<strong>Ataque:</strong> Ataca a 1 nave (aunque esté fuera de tu arco de fuego).<br /><br />Tus resultados %HIT% no pueden ser anulados por los dados de defensa.<br /><br />El defensor puede anular tus resultados %CRIT% antes que los %HIT%."
    },
    "Advanced Targeting Computer": {
      ship: "TIE Avanzado",
      name: "Computadora de Selección de Blancos Avanzada",
      text: "<span class=\"card-restriction\">Solo TIE Avanzado.</span>%LINEBREAK%Cuando ataques con tu armamento principal, si tienes al defensor fijado como blanco, puedes añadir 1 %CRIT% al resultado de tu tirada. Si decides hacerlo, no podrás gastar fichas de Blanco Fijado durante este ataque."
    },
    "Ion Cannon Battery": {
      name: "Batería de Cañones de Iones",
      text: "<strong>Ataque (Energía):</strong> Gasta 2 de Energía de esta carta para efectuar este ataque. Si este ataque impacta, el defensor sufre 1 de daño crítico y recibe 1 ficha de Iones. Después se anulan <strong>todos<strong> los resultados de los dados."
    },
    "Emperor Palpatine": {
      name: "Emperador Palpatine",
      text: "%IMPERIALONLY%%LINEBREAK%Una vez por ronda, puedes cambiar el resultado de una tirada de dado efectuada por cualquier nave aliada por el de cualquier otro resultado posible para ese dado. El resultado de ese dado no podrá volver a ser modificado."
    },
    "Bossk": {
      text: "%SCUMONLY%%LINEBREAK%Después de que realices un ataque y falles, si no tienes fichas de Tensión <strong>debes</strong> recibir 1 ficha de Tensión. Después asigna 1 ficha de Concentración a tu nave y fija al defensor como blanco."
    },
    "Lightning Reflexes": {
      name: "Reflejos Rápidos",
      text: "%SMALLSHIPONLY%%LINEBREAK%Después de que ejecutes una maniobra blanca o verde en tu selector, puedes descartar esta carta para rotar tu nave 180º. Luego recibes 1 ficha de Tensión <strong>después</strong> del paso de \"comprobar Tensión del piloto."
    },
    "Twin Laser Turret": {
      name: "Torreta Láser Doble",
      text: "<strong>Ataque:</strong> Efectúa este ataque <strong>dos veces</strong> (incluso contra una nave situada fuera de tu arco de fuego).<br /><br />Cada vez que este ataque impacte, el defensor sufre 1 de daño. Luego se anulan <strong>todos</strong> los resultados de los dados."
    },
    "Plasma Torpedoes": {
      name: "Torpedos de Plasma",
      text: "<strong>Ataque (Blanco fijado):</strong> Gasta tu ficha de Blanco fijado y descarta esta carta para efectuar este ataque.<br /><br />Si el ataque impacta, después de inflingir daños quita 1 ficha de Escudos del defensor."
    },
    "Ion Bombs": {
      name: "Bombas de Iones",
      text: "Cuando reveles tu selector de maniobras, puedes descartar esta carta para <strong>soltar</strong> 1 ficha de Bomba de iones.<br /><br />Esta ficha <strong>detona</strong> al final de la fase de Activación.<br /><br /><strong>Ficha de Bomba de iones:</strong> Cuando se detona esta ficha de Bomba, toda nave que se encuentre a alcance 1 de ella recibe 2 fichas de Iones. Después se descarta esta ficha."
    },
    "Conner Net": {
      name: "Red Conner",
      text: "<strong>Acción:</strong> Descarta esta carta para <strong>soltar</strong> 1 ficha de Red Conner.<br /><br />Esta ficha se <strong>detona</strong> cuando la peana o plantilla de maniobra de una nave se solape con ella.<br /><br /><strong>Ficha de Red Conner:</strong> Cuando es detona esta ficha de Bomba, la nave que la haya atravesado o solapado sufre 1 daño, recibe 2 fichas de Iones y se salta su paso de \"Realizar una acción\". Después se descarta esta ficha."
    },
    "Bombardier": {
      name: "Bombardero",
      text: "Cuando sueltes una bomba, puedes usar la plantilla (%STRAIGHT% 2) en lugar de la plantilla (%STRAIGHT% 1)."
    },
    "Cluster Mines": {
      name: "Minas de Racimo",
      text: "<strong>Acción:</strong> Descarta esta carta para <strong>soltar</strong> 1 conjunto de Minas de racimo.<br /><br />Cada ficha de Mina de racimo se <strong>detona</strong> cuando la peana o plantilla de maniobra de una nave se solapa con ella.<br /><br /><strong>Ficha de Mina de racimo:</strong> Cuando se detona una de estas fichas de Bomba, la nave que la haya atravesado o solapado tira 2 dados de ataque y sufre todo el daño (%HIT%) obtenido en la tirada. Después se descarta esta ficha."
    },
    'Crack Shot': {
      name: "Tiro Certero",
      text: 'Cuando ataques a una nave situada dentro de tu arco de fuego, puedes descartar esta carta para anular 1 resultad %EVADE% del defensor.'
    },
    "Advanced Homing Missiles": {
      name: "Misiles Rastreadores Avanzados",
      text: "<strong>Ataque (Blanco fijado):</strong> Descarta esta carta para efectuar este ataque.%LINEBREAK%Si el ataque impacta, inflinge 1 carta de Daño boca arriba al defensor. Luego se anulan <strong>todos</strong> los resultados de los dados."
    },
    'Agent Kallus': {
      name: "Agente Kallus",
      text: '%IMPERIALONLY%%LINEBREAK%Al comienzo de la primera ronda, elige 1 nave enemiga pequeña o grande. Cuando ataques a esa nave o te defiendas de esa nave, puedes cambiar 1 de tus resultados %FOCUS% por un resultado %HIT% o %EVADE%.'
    },
    'XX-23 S-Thread Tracers': {
      text: "<strong>Attack (focus):</strong> Discard this card to perform this attack.  If this attack hits, each friendly ship at Range 1-2 of you may acquire a target lock on the defender.  Then cancel <strong>all</strong> dice results."
    },
    "Tractor Beam": {
      text: "<strong>Attack:</strong> Attack 1 ship.%LINEBREAK%If this attack hits, the defender receives 1 tractor beam token.  Then cancel <strong>all</strong> dice results."
    },
    "Cloaking Device": {
      text: "%SMALLSHIPONLY%%LINEBREAK%<strong>Action:</strong> Perform a free cloak action.%LINEBREAK%At the end of each round, if you are cloaked, roll 1 attack die.  On a %FOCUS% result, discard this card, then decloak or discard your cloak token."
    },
    "Shield Technician": {
      name: "Técnico de Escudos",
      text: "%HUGESHIPONLY%%LINEBREAK%Cuando lleves a cabo una acción de recuperación, en vez de retirar todas tus fichas de Energía, puedes elegir qué cantidad de fichas de Energía deseas retirar."
    },
    "Grand Moff Tarkin": {
      text: "%HUGESHIPONLY%%IMPERIALONLY%%LINEBREAK%Al comienzo de la fase de Combate, puedes elegir otra nave que tengas a alcance 1-4. Escoge entre retirar 1 ficha de Concentración de la nave elegida o asignarle 1 ficha de Concentración a esa nave."
    },
    "Captain Needa": {
      name: "Capitán Needa",
      text: "%HUGESHIPONLY%%IMPERIALONLY%%LINEBREAK%Si durante la fase de Activación te solapas con un obstáculo, en vez de recibir 1 carta de Daño boca arriba, tira 1 dado de ataque. Si sacas %HIT% o %CRIT%, sufres 1 de daño."
    },
    "Admiral Ozzel": {
      name: "Almirante Ozzel",
      text: "%HUGESHIPONLY%%IMPERIALONLY%%LINEBREAK%<strong>ENERGÍA</strong>: Puedes descartar hasta 3 fichas de Escudos de tu nave. Por cada ficha de Escudos descartada, obtienes 1 de Energía."
    },
    'Glitterstim': {
      name: "Brillestim",
      text: "Al comienzo de la fase de Combate, puedes descartar esta carta y recibir 1 ficha de Tensión. Si lo haces, hasta el final de la ronda, cuando ataques o defiendes puedes cambiar todos tus resultados %FOCUS% por resultados %HIT% o %EVADE%."
    },
    'Extra Munitions': {
      name: "Munición Adicional",
      text: "Cuando te equipas con esta carta, coloca 1 ficha de Munición de artillería sobre cada carta de Mejora %TORPEDO%, %MISSILE% y %BOMB% que tengas equipada. Cuando se te indique que descartes una carta de Mejora, en vez de eso puedes descartar 1 ficha de Munición de artillería que haya encima de esa carta."
    },
    "Weapons Guidance": {
      name: "Sistema de Guiado de Armas",
      text: "Cuando ataques, puedes gastar una ficha de Concentración para cambiar 1 de tus resultados de cara vacia por un resultado %HIT%."
    },
    "BB-8": {
      text: "Cuando reveles una maniobra verde, puedes realizar una acción gratuita de tonel volado."
    },
    "R5-X3": {
      text: "Antes de revelar tu maniobra, puedes descartar esta carta para ignorar todos los obstáculos hasta el final de la ronda."
    },
    "Wired": {
      name: "Enardecido",
      text: "Cuando ataques o te defiendas, si estás bajo tensión, puedes volver a tirar 1 o más de tus resultados %FOCUS%."
    },
    'Cool Hand': {
      name: "Mano Firme",
      text: 'Cuando recibas una ficha de Tensión, puedes descartar esta carta para asignar 1 ficha de Concetración o de Evasión a tu nave.'
    },
    'Juke': {
      name: "Finta",
      text: '%SMALLSHIPONLY%%LINEBREAK%Cuando ataques, si tienes una ficha de Evasión, puedes cambiar 1 de los resultados %EVADE% del defensor por un resultado %FOCUS%.'
    },
    'Comm Relay': {
      name: "Repetidor de Comunicaciones",
      text: 'No puedes tener más de 1 ficha de Evasión.%LINEBREAK%Durante la fase Final, no retires de tu nave las fichas de Evasión que no hayas usado.'
    },
    'Dual Laser Turret': {
      text: '%GOZANTIONLY%%LINEBREAK%<strong>Attack (energy):</strong> Spend 1 energy from this card to perform this attack against 1 ship (even a ship outside your firing arc).'
    },
    'Broadcast Array': {
      text: '%GOZANTIONLY%%LINEBREAK%Your action bar gains the %JAM% action icon.'
    },
    'Rear Admiral Chiraneau': {
      text: '%HUGESHIPONLY% %IMPERIALONLY%%LINEBREAK%<strong>Action:</strong> Execute a white (%STRAIGHT% 1) maneuver.'
    },
    'Ordnance Experts': {
      text: 'Once per round, when a friendly ship at Range 1-3 performs an attack with a %TORPEDO% or %MISSILE% secondary weapon, it may change 1 of its blank results to a %HIT% result.'
    },
    'Docking Clamps': {
      text: '%GOZANTIONLY% %LIMITED%%LINEBREAK%You may attach 4 up to TIE fighters, TIE interceptors, TIE bombers, or TIE Advanced to this ship.  All attached ships must have the same ship type.'
    },
    '"Zeb" Orrelios': {
      text: "%REBELONLY%%LINEBREAK%Enemy ships inside your firing arc that you are touching are not considered to be touching you when either you or they activate during the Combat phase."
    },
    'Kanan Jarrus': {
      text: "%REBELONLY%%LINEBREAK%Once per round, after a friendly ship at Range 1-2 executes a white maneuver, you may remove 1 stress token from that ship."
    },
    'Reinforced Deflectors': {
      text: "%LARGESHIPONLY%%LINEBREAK%After you suffer 3 or more damage from an attack, recover one shield (up to your shield value)."
    },
    'Dorsal Turret': {
      text: "<strong>Attack:</strong> Attack 1 ship (even a ship outside your firing arc).%LINEBREAK%If the target of this attack is at Range 1, roll 1 additional attack die."
    },
    'Targeting Astromech': {
      name: "Droide Astromecánico de Selección de Blancos",
      text: 'Después de que ejecutes una maniobra roja, puedes fijar un blanco.'
    },
    'Hera Syndulla': {
      text: "%REBELONLY%%LINEBREAK%You may reveal and execute red maneuvers even while you are stressed."
    },
    'Ezra Bridger': {
      text: "%REBELONLY%%LINEBREAK%When attacking, if you are stressed, you may change 1 of your %FOCUS% results to a %CRIT% result."
    },
    'Sabine Wren': {
      text: "%REBELONLY%%LINEBREAK%Your upgrade bar gains the %BOMB% upgrade icon.  Once per round, before a friendly bomb token is removed, choose 1 enemy ship at Range 1 of that token. That ship suffers 1 damage."
    },
    '"Chopper"': {
      text: "%REBELONLY%%LINEBREAK%You may perform actions even while you are stressed.%LINEBREAK%After you perform an action while you are stressed, suffer 1 damage."
    },
    'Construction Droid': {
      text: '%HUGESHIPONLY% %LIMITED%%LINEBREAK%When you perform a recover action, you may spend 1 energy to discard 1 facedown Damage card.'
    },
    'Cluster Bombs': {
      text: 'After defending, you may discard this card.  If you do, each other ship at Range 1 of the defending section rolls 2 attack dice, suffering all damage (%HIT%) and critical damage (%CRIT%) rolled.'
    },
    "Adaptability (+1)": {
      text: "<span class=\"card-restriction\">Dual card.</span>%LINEBREAK%Increase your pilot skill value by 1."
    },
    "Adaptability (-1)": {
      text: "<span class=\"card-restriction\">Dual card.</span>%LINEBREAK%Decrease your pilot skill value by 1."
    },
    "Electronic Baffle": {
      text: "When you receive a stress token or an ion token, you may suffer 1 damage to discard that token."
    },
    "4-LOM": {
      text: "%SCUMONLY%%LINEBREAK%When attacking, during the \"Modify Attack Dice\" step, you may receive 1 ion token to choose 1 of the defender's focus or evade tokens.  That token cannot be spent during this attack."
    },
    "Zuckuss": {
      text: "%SCUMONLY%%LINEBREAK%When attacking, you may receive any number of stress tokens to choose an equal number of defense dice.  The defender must reroll those dice."
    },
    'Rage': {
      text: "<strong>Action:</strong> Assign 1 focus token to your ship and receive 2 stress tokens.  Until the end of the round, when attacking, you may reroll up to 3 attack dice."
    },
    "Attanni Mindlink": {
      text: "%SCUMONLY%%LINEBREAK%Each time you are assigned a focus or stress token, each other friendly ship with Attanni Mindlink must also be assigned the same type of token if it does not already have one."
    },
    "Boba Fett": {
      text: "%SCUMONLY%%LINEBREAK%After performing an attack, if the defender was dealt a faceup Damage card, you may discard this card to choose and discard 1 of the defender's Upgrade cards."
    },
    "Dengar": {
      text: "%SCUMONLY%%LINEBREAK%When attacking, you may reroll 1 attack die.  If the defender is a unique pilot, you may instead reroll up to 2 attack dice."
    },
    '"Gonk"': {
      text: "%SCUMONLY%%LINEBREAK%<strong>Action:</strong> Place 1 shield token on this card.%LINEBREAK%<strong>Action:</strong> Remove 1 shield token from this card to recover 1 shield (up to your shield value)."
    },
    "R5-P8": {
      text: "Once per round, after defending, you may roll 1 attack die.  On a %HIT% result, the attacker suffers 1 damage.  On a %CRIT% result, you and the attacker each suffer 1 damage."
    },
    'Thermal Detonators': {
      text: "When you reveal your maneuver dial, you may discard this card to <strong>drop</strong> 1 thermal detonator token.%LINEBREAK%This token <strong>detonates</strong> at the end of the Activation phase.%LINEBREAK%<strong>Thermal Detonator Token:</strong> When this bomb token detonates, each ship at Range 1 of the token suffers 1 damage and receives 1 stress token.  Then discard this token."
    },
    "Overclocked R4": {
      text: "During the Combat phase, when you spend a focus token, you may receive 1 stress token to assign 1 focus token to your ship."
    }
  };
  modification_translations = {
    "Stealth Device": {
      name: "Dispositivo de Sigilo",
      text: "Tu Agilidad se incrementa en 1. Descarta esta carta si eres alcanzado por un ataque."
    },
    "Shield Upgrade": {
      name: "Escudos Mejorados",
      text: "Tu valor de Escudos se incrementa en 1."
    },
    "Engine Upgrade": {
      name: "Motor Mejorado",
      text: "Tu barra de acciones gana el ícono %BOOST%."
    },
    "Anti-Pursuit Lasers": {
      name: "Cañones Láser Antipersecución",
      text: "Después de que una nave enemiga ejecute una maniobra que le cause solapar su peana con la tuya, lanza un dado de ataque. Si el resultado es %HIT% o %CRIT%, el enemigo sufre 1 de daño."
    },
    "Targeting Computer": {
      name: "Computadora de Selección de Blancos",
      text: "Tu barra de acciones gana el icono %TARGETLOCK%."
    },
    "Hull Upgrade": {
      name: "Blindaje mejorado",
      text: "Tu valor de Casco se incrementa en 1."
    },
    "Munitions Failsafe": {
      name: "Sistema de Munición a Prueba de Fallas",
      text: "Cuando ataques con un armamento secundario que requiera descartarlo para efectuar el ataque, no se descarta a menos que el ataque impacte al objetivo."
    },
    "Stygium Particle Accelerator": {
      name: "Acelerador de Partículas de Estigio",
      text: "<span class=\"card-restriction\">Soo TIE Fantasma.</span><br /><br />Cuando realices una acción de camuflaje o desactives tu camuflaje, puedes realizar una acción gratuita de Evasión."
    },
    "Advanced Cloaking Device": {
      name: "Dispositivo de Camuflaje Avanzado",
      text: "Despues de que efectúes un ataque, puedes realizar una acción gratuita de camuflaje.",
      ship: "TIE Fantasma"
    },
    "Combat Retrofit": {
      name: "Equipamiento de Combate",
      text: "<span class=\"card-restriction\">Solo GR-75.</span><br /><br />Tu valor de casco se incrementa en 2 y tu valor de escudos se incrementa en 1.",
      ship: 'Transporte mediano GR-75'
    },
    "B-Wing/E2": {
      text: "<span class=\"card-restriction\">Solo Ala-B.</span><br /><br />Tu barra de mejoras gana el icono de mejora %CREW%.",
      ship: "Ala-B"
    },
    "Countermeasures": {
      name: "Contramedidas",
      text: "Al comienzo de la fase de Combate, puedes descartar esta carta para aumentar en 1 tu Agilidad hasta el final de la ronda. Después puedes quitar 1 ficha enemiga de Blanco Fijado de tu nave."
    },
    "Experimental Interface": {
      name: "Interfaz Experimental",
      text: "Una vez por ronda, después de que realices una acción, puedes llevar a cabo 1 acción gratuita de una carta de Mejora equipada que tenga el encabezado \"<strong>Acción:</strong>\". Después recibes 1 ficha de Tension."
    },
    "Tactical Jammer": {
      name: "Inhibidor Táctico",
      text: "Tu nave puede obstruir ataques enemigos."
    },
    "Autothrusters": {
      name: "Propulsores Automatizados",
      text: "Cuando te defiendas, si estás más allá de alcance 2 o fuera del arco de fuego del atacante, puedes cambiar 1 de tus resultados de cara vacía por un resultado %EVADE%. Sólo puedes equiparte con esta carta si tienes el icono de acción %BOOST%."
    },
    "Twin Ion Engine Mk. II": {
      name: "Motor Iónico Doble Modelo II",
      text: "Puedes tratar todas las maniobras de inclinación (%BANKLEFT% y %BANKRIGHT%) como si fueran maniobras verdes."
    },
    "Maneuvering Fins": {
      name: "Alerones de Estabilización",
      text: "Cuando reveles una maniobra de giro (%TURNLEFT% o %TURNRIGHT%), puedes rotar tu selector para elegir en su lugar la maniobra de inclinación correspondiente (%BANKLEFT% o %BANKRIGHT%) de igual velocidad."
    },
    "Ion Projector": {
      name: "Proyector de Iones",
      text: "%LARGESHIPONLY%%LINEBREAK%Después de que una nave enemiga ejecute una maniobra que la solape con tu nave, tira 1 dado de ataque. Si sacas %HIT% o %CRIT%, la nave enemiga recibe 1 ficha de Iones."
    },
    "Advanced SLAM": {
      name: "Motor Sublumínico Avanzado",
      text: "Después de efectuar una acción de MASA, si no te has solapado con un obstáculo ni con otra nave, puedes llevar a cabo una acctión gratuita."
    },
    'Integrated Astromech': {
      name: "Droide Astromecánico Integrado",
      text: '<span class="card-restriction">Solo X-wing.</span>%LINEBREAK%Cuando recibas una carta de Daño, puedes descartar 1 de tus cartas de Mejora %ASTROMECH% para descartar esa carta de Daño (sin resolver su efecto).'
    },
    'Optimized Generators': {
      text: '%HUGESHIPONLY%%LINEBREAK%Once per round, when you assign energy to an equipped Upgrade card, gain 2 energy.'
    },
    'Automated Protocols': {
      text: '%HUGESHIPONLY%%LINEBREAK%Once per round, after you perform an action that is not a recover or reinforce action, you may spend 1 energy to perform a free recover or reinforce action.'
    },
    'Ordnance Tubes': {
      text: '%HUGESHIPONLY%%LINEBREAK%You may treat each of your %HARDPOINT% upgrade icons as a %TORPEDO% or %MISSILE% icon.%LINEBREAK%When you are instructed to discard a %TORPEDO% or %MISSILE% Upgrade card, do not discard it.'
    },
    'Long-Range Scanners': {
      text: 'You can acquire target locks on ships at Range 3 and beyond.  You cannot acquire target locks on ships at Range 1-2.  You can equip this card only if you have %TORPEDO% and %MISSILE% in your upgrade bar.'
    },
    "Guidance Chips": {
      text: "Once per round, when attacking with a %TORPEDO% or %MISSILE% secondary weapon, you may change 1 die result to a %HIT% result (or a %CRIT% result if your primary weapon value is \"3\" or higher)."
    }
  };
  title_translations = {
    "Slave I": {
      name: "Esclavo 1",
      text: "<span class=\"card-restriction\">Solo Firespray-31.</span><br /><br />Tu barra de mejoras gana el icono %TORPEDO%."
    },
    "Millennium Falcon": {
      name: "Halcón Milenario",
      text: "<span class=\"card-restriction\">Solo YT-1300.</span><br /><br />Tu barra de acciones gana el icono %EVADE%."
    },
    "Moldy Crow": {
      name: "Cuervo Oxidado",
      text: "<span class=\"card-restriction\">Solo HWK-290.</span><br /><br />Durante la fase Final, no retires de tu nave las fichas de Concentración que no hayas usado."
    },
    "ST-321": {
      text: "<span class=\"card-restriction\">Solo Lanzadera clase <em>Lambda</em>.</span><br /><br />Cuando fijas un blanco, puedes hacerlo con cualquier nave enemiga de la zona de juego.",
      ship: "Lanzadera clase Lambda"
    },
    "Royal Guard TIE": {
      name: "TIE de la Guardia Real",
      ship: "Interceptor TIE",
      text: "<span class=\"card-restriction\">Solo TIE Interceptor.</span><br /><br />Puedes equipar un máximo de 2 mejoras de Modificación (en vez de 1).<br /><br />Esta mejora no puede equiparse en naves con pilotos de Habilidad 4 o inferior."
    },
    "Dodonna's Pride": {
      name: "Orgullo de Donna",
      text: "<span class=\"card-restriction\">Solo sección de proa de CR90.</span><br /><br />Cuando realices una accion de Coordinación, puedes elegir 2 naves aliadas en vez de 1. Cada una de estas naves pueden realizar 1 accion gratuita.",
      ship: "Corbeta CR90 (Proa)"
    },
    "A-Wing Test Pilot": {
      name: "Piloto de Ala-A experimental",
      text: "<span class=\"card-restriction\">Solo Ala-A.</span><br /><br />Tu barra de mejoras gana 1 icono de mejora %ELITE%.<br /><br />No puedes equipar 2 cartas de Mejora %ELITE% iguales. Tampoco te puedes equipar con esta carta si la Habilidad de tu piloto es 1 o inferior.",
      ship: "Ala-A"
    },
    "Tantive IV": {
      name: "Tantive IV",
      text: "<span class=\"card-restriction\">Solo sección de proa de CR90.</span><br /><br />La barra de mejoras de tu sección de proa gana 1 icono adicional de %CREW% y 1 icono adicional de %TEAM%.",
      ship: "Corbeta CR90 (Proa)"
    },
    "Bright Hope": {
      name: "Esperanza Brillante",
      text: "<span class=\"card-restriction\">Solo GR-75.</span><br /><br />Una ficha de Refuerzo asignada a tu seccion de proa añade 2 resultados de %EVADE% en vez de 1.",
      ship: 'Transporte mediano GR-75'
    },
    "Quantum Storm": {
      name: "Tormenta Cuántica",
      text: "<span class=\"card-restriction\">Solo GR-75.</span><br /><br />Al principio de la fase Final, si tienes 1 ficha de Energía o menos, ganas 1 ficha de Energía.",
      ship: 'Transporte mediano GR-75'
    },
    "Dutyfree": {
      name: "Libre de Impuestos",
      text: "<span class=\"card-restriction\">Solo GR-75./span><br /><br />Cuando realices una acción de Interferencia, puedes elegir una nave enemiga situada a alcance 1-3 en lugar de 1-2.",
      ship: 'Transporte mediano GR-75'
    },
    "Jaina's Light": {
      name: "Luz de Jaina",
      text: "<span class=\"card-restriction\">Solo sección de proa de CR90.</span><br /><br />Cuando te defiendas, una vez por ataque, si recibes una carta de Daño boca arriba, puedes descartarla y robar otra carta de Daño boca arriba."
    },
    "Outrider": {
      name: "Jinete del Espacio",
      text: "<span class=\"card-restriction\">Solo YT-2400.</span><br /><br />Mientras tu nave tenga equipada una mejora de %CANNON%, <strong>no puedes</strong> atacar con tu armamento principal y puedes atacar con armamentos secundarios %CANNON% contra naves enemigas fuera de tu arco de fuego."
    },
    "Andrasta": {
      name: "Andrasta",
      text: "<span class=\"card-restriction\">Solo Firespray-31.</span><br /><br />Tu barra de mejoras gana 2 iconos %BOMB% adicionales."
    },
    "TIE/x1": {
      ship: "TIE Avanzado",
      text: "<span class=\"card-restriction\">Solo TIE Avanzado.</span>%LINEBREAK%Tu barra de mejoras gana el icono %SYSTEM%.%LINEBREAK%Si te equipas con una mejora %SYSTEM%, su coste en puntos de escuadrón se reduce en 4 (hasta un mínimo de 0)."
    },
    "BTL-A4 Y-Wing": {
      name: "BTL-A4 Ala-Y",
      text: "<span class=\"card-restriction\">Solo Ala-Y.</span><br /><br />No puedes atacar naves que estén fuera de tu arco de fuego. Después de que efectúes un ataque con tu armamento principal, puedes realizar inmediatamente un ataque con arma secundaria %TURRET%.",
      ship: "Ala-Y"
    },
    "IG-2000": {
      name: "IG-2000",
      text: "<span class=\"card-restriction\">Solo Agresor.</span><br /><br />Tu piloto tiene la misma capacidad especial que cualquier otra nave aliada equipada con la carta de Mejora <em>IG-2000</em> (además de su propia capacidad especial).",
      ship: "Agresor"
    },
    "Virago": {
      name: "Virago",
      text: "<span class=\"card-restriction\">Solo Víbora Estelar.</span><br /><br />Tu barra de mejoras gana los iconos %SYSTEM% y %ILLICIT%.<br /><br />Esta mejora no puede equiparse en naves con pilotos de Habilidad 3 o inferior.",
      ship: 'Víbora Estelar'
    },
    '"Heavy Scyk" Interceptor (Cannon)': {
      name: 'Interceptor "Scyk Pesado" (Cañón)',
      text: "<span class=\"card-restriction\">Solo Interceptor M3-A.</span><br /><br />Tu barra de mejoras gana el icono %CANNON%.",
      ship: 'Interceptor M3-A'
    },
    '"Heavy Scyk" Interceptor (Missile)': {
      name: 'Interceptor "Scyk Pesado" (Misil)',
      text: "<span class=\"card-restriction\">Solo Interceptor M3-A.</span><br /><br />Tu barra de mejoras gana el icono %MISSILE%.",
      ship: 'Interceptor M3-A'
    },
    '"Heavy Scyk" Interceptor (Torpedo)': {
      name: 'Interceptor "Scyk Pesado" (Torpedo)',
      text: "<span class=\"card-restriction\">Solo Interceptor M3-A.</span><br /><br />Tu barra de mejoras gana el icono %TORPEDO%.",
      ship: 'Interceptor M3-A'
    },
    "Dauntless": {
      name: "Intrépido",
      text: "<span class=\"card-restriction\">Solo VT-49 Diezmador.</span><br /><br />Después de que ejecutes una maniobra que te solape con otra nave, puedes realizar 1 acción gratuita. Luego recibes 1 ficha de Tensión.",
      ship: 'VT-49 Diezmador'
    },
    "Ghost": {
      text: "<span class=\"card-restriction\">VCX-100 only.</span>%LINEBREAK%Equip the <em>Phantom</em> title card to a friendly Attack Shuttle and dock it to this ship.%LINEBREAK%After you execute a maneuver, you may deploy it from your rear guides."
    },
    "Phantom": {
      text: "While you are docked, the <em>Ghost</em> can perform primary weapon attacks from its special firing arc, and, at the end of the Combat phase, it may perform an additional attack with an equipped %TURRET%. If it performs this attack, it cannot attack again this round."
    },
    "TIE/v1": {
      text: "<span class=\"card-restriction\">TIE Advanced Prototype only.</span>%LINEBREAK%After you acquire a target lock, you may perform a free evade action."
    },
    "Mist Hunter": {
      text: "<span class=\"card-restriction\">G-1A starfighter only.</span>%LINEBREAK%Your upgrade bar gains the %BARRELROLL% Upgrade icon.%LINEBREAK%You <strong>must</strong> equip 1 \"Tractor Beam\" Upgrade card (paying its squad point cost as normal)."
    },
    "Punishing One": {
      text: "<span class=\"card-restriction\">JumpMaster 5000 only.</span>%LINEBREAK%Increase your primary weapon value by 1."
    },
    "Hound's Tooth": {
      name: "Diente de Perro",
      text: "<span class=\"card-restriction\">Solo YV-666.</span>%LINEBREAK%Después de que seas destruido, y antes de retirarte de la zona de juego, puedes <strong>desplegar</strong> al Piloto del <span>Cachorro de Nashtah</span>.%LINEBREAK%El <span>Cachorro de Nashtah</span> no puede atacar en esta ronda."
    },
    "Assailer": {
      name: "Acometedor",
      text: "<span class=\"card-restriction\">Sólo sección de popa de corbeta clase <em>Incursor</em>.</span>%LINEBREAK%Cuando te defiendas, si la sección atacada tiene asginada una ficha de Refuerzo, puedes cambiar 1 resultado de %FOCUS% por 1 resultado %EVADE%."
    },
    "Instigator": {
      name: "Instigador",
      text: "<span class=\"card-restriction\">Sólo sección de popa de corbeta clase <em>Incursor</em>.</span>%LINEBREAK%ADespués de que hayas llevado a cabo una acción de recuperación, recuperas 1 de Escudos adicional."
    },
    "Impetuous": {
      name: "Impetuoso",
      text: "<span class=\"card-restriction\">Sólo sección de popa de corbeta clase <em>Incursor</em>.</span>%LINEBREAK%Después de que hayas efectuado un ataque que destruya una nave enemiga, puedes fijar un blanco."
    },
    'TIE/x7': {
      text: '<span class="card-restriction">TIE Defender only.</span>%LINEBREAK%Your upgrade bar loses the %CANNON% and %MISSILE% upgrade icons.%LINEBREAK%After executing a 3-, 4-, or 5-speed maneuver, you may assign 1 evade token to your ship.',
      ship: 'Defensor TIE'
    },
    'TIE/D': {
      text: '<span class="card-restriction">TIE Defender only.</span>%LINEBREAK%Once per round, after you perform an attack with a %CANNON% secondary weapon that costs 3 or fewer squad points, you may perform a primary weapon attack.',
      ship: 'Defensor TIE'
    },
    'TIE Shuttle': {
      text: '<span class="card-restriction">TIE Bomber only.</span>%LINEBREAK%Your upgrade bar loses all %TORPEDO%, %MISSILE%, and %BOMB% upgrade icons and gains 2 %CREW% upgrade icons.  You cannot equip a %CREW% Upgrade card that costs more than 4 squad points.'
    },
    'Requiem': {
      text: '%GOZANTIONLY%%LINEBREAK%When you deploy a ship, treat its pilot skill value as "8" until the end of the round.'
    },
    'Vector': {
      text: '%GOZANTIONLY%%LINEBREAK%After you execute a maneuver, you may deploy up to 4 attached ships (instead of 2).'
    },
    'Suppressor': {
      text: '%GOZANTIONLY%%LINEBREAK%Once per round, after you acquire a target lock, you may remove 1 focus, evade, or blue target lock token from that ship.'
    }
  };
  return exportObj.setupCardData(basic_cards, pilot_translations, upgrade_translations, modification_translations, title_translations);
};

exportObj = typeof exports !== "undefined" && exports !== null ? exports : this;

if (exportObj.codeToLanguage == null) {
  exportObj.codeToLanguage = {};
}

exportObj.codeToLanguage.fr = 'Français';

if (exportObj.translations == null) {
  exportObj.translations = {};
}

exportObj.translations['Français'] = {
  action: {
    "Barrel Roll": "Tonneau",
    "Boost": "Accélération",
    "Evade": "Évasion",
    "Focus": "Concentration",
    "Target Lock": "Acquisition de cible",
    "Recover": "Récupération",
    "Reinforce": "Renforcement",
    "Jam": "Brouillage",
    "Coordinate": "Coordination",
    "Cloak": "Occultation"
  },
  slot: {
    "Astromech": "Astromech",
    "Bomb": "Bombe",
    "Cannon": "Cannon",
    "Crew": "Équipage",
    "Elite": "Trait de pilote",
    "Missile": "Missile",
    "System": "Système",
    "Torpedo": "Torpille",
    "Turret": "Tourelle",
    "Cargo": "Soute",
    "Hardpoint": "Point d'Attache",
    "Team": "Équipe",
    "Illicit": "Illégal",
    "Salvaged Astromech": "Astromech Récupéré"
  },
  sources: {
    "Core": "Boite de base",
    "A-Wing Expansion Pack": "Paquet d'extension A-Wing",
    "B-Wing Expansion Pack": "Paquet d'extension B-Wing",
    "X-Wing Expansion Pack": "Paquet d'extension X-Wing",
    "Y-Wing Expansion Pack": "Paquet d'extension Y-Wing",
    "Millennium Falcon Expansion Pack": "Paquet d'extension Faucon Millennium",
    "HWK-290 Expansion Pack": "Paquet d'extension HWK-290",
    "TIE Fighter Expansion Pack": "Paquet d'extension Chasseur TIE",
    "TIE Interceptor Expansion Pack": "Paquet d'extension Intercepteur TIE",
    "TIE Bomber Expansion Pack": "Paquet d'extension Bombardier TIE",
    "TIE Advanced Expansion Pack": "Paquet d'extension TIE Advanced",
    "Lambda-Class Shuttle Expansion Pack": "Paquet d'extension Navette de classe Lambda",
    "Slave I Expansion Pack": "Paquet d'extension Slave I",
    "Imperial Aces Expansion Pack": "Paquet d'extension As Impériaux",
    "Rebel Transport Expansion Pack": "Paquet d'extension Transport Rebelle",
    "Z-95 Headhunter Expansion Pack": "Paquet d'extension Chasseur de têtes Z-95",
    "TIE Defender Expansion Pack": "Paquet d'extension Défenseur TIE",
    "E-Wing Expansion Pack": "Paquet d'extension E-Wing",
    "TIE Phantom Expansion Pack": "Paquet d'extension TIE Fantôme",
    "Tantive IV Expansion Pack": "Paquet d'extension Tantive IV",
    "Rebel Aces Expansion Pack": "Paquet d'extension As Rebelles",
    "YT-2400 Freighter Expansion Pack": "Paquet d'extension Cargo YT-2400",
    "VT-49 Decimator Expansion Pack": "Paquet d'extension Décimateur VT-49",
    "StarViper Expansion Pack": "Paquet d'extension StarViper",
    "M3-A Interceptor Expansion Pack": "Paquet d'extension Intercepteur M3-A",
    "IG-2000 Expansion Pack": "Paquet d'extension IG-2000",
    "Most Wanted Expansion Pack": "Paquet d'extension Ennemis Publics",
    "Imperial Raider Expansion Pack": "Imperial Raider Expansion Pack",
    "The Force Awakens Core Set": "The Force Awakens Core Set"
  },
  ui: {
    shipSelectorPlaceholder: "Choisissez un vaisseau",
    pilotSelectorPlaceholder: "Choisissez un pilote",
    upgradePlaceholder: function(translator, language, slot) {
      return "" + (translator(language, 'slot', slot));
    },
    modificationPlaceholder: "Modification",
    titlePlaceholder: "Titre",
    upgradeHeader: function(translator, language, slot) {
      return "Amélioration " + (translator(language, 'slot', slot));
    },
    unreleased: "inédit",
    epic: "épique"
  },
  byCSSSelector: {
    '.xwing-card-browser .translate.sort-cards-by': 'Trier les cartes par',
    '.xwing-card-browser option[value="name"]': 'Nom',
    '.xwing-card-browser option[value="source"]': 'Source',
    '.xwing-card-browser option[value="type-by-points"]': 'Type (par Points)',
    '.xwing-card-browser option[value="type-by-name"]': 'Type (par Nom)',
    '.xwing-card-browser .translate.select-a-card': 'Sélectionnez une carte depuis la liste sur la gauche.',
    '.xwing-card-browser .info-range td': 'Portée',
    '.info-well .info-ship td.info-header': 'Vaisseau',
    '.info-well .info-skill td.info-header': 'Valeur de pilotage',
    '.info-well .info-actions td.info-header': 'Actions',
    '.info-well .info-upgrades td.info-header': 'Améliorations',
    '.info-well .info-range td.info-header': 'Portée',
    '.clear-squad': 'Nouvel escadron',
    '.save-list': 'Enregistrer',
    '.save-list-as': 'Enregistrer sous…',
    '.delete-list': 'Supprimer',
    '.backend-list-my-squads': 'Charger un escadron',
    '.view-as-text': '<span class="hidden-phone"><i class="icon-print"></i>&nbsp;Imprimer/Afficher commme </span>Texte',
    '.randomize': 'Aléatoire',
    '.randomize-options': 'Options…',
    '.notes-container > span': 'Squad Notes',
    '.bbcode-list': 'Copiez le BBCode ci-dessous et collez-le dans votre post.<textarea></textarea><button class="btn btn-copy">Copiez</button>',
    '.html-list': '<textarea></textarea><button class="btn btn-copy">Copiez</button>',
    '.vertical-space-checkbox': "Ajouter de l'espace pour les cartes d'amélioration et de dégâts lors de l'impression <input type=\"checkbox\" class=\"toggle-vertical-space\" />",
    '.color-print-checkbox': "Imprimer en couleur <input type=\"checkbox\" class=\"toggle-color-print\" />",
    '.print-list': '<i class="icon-print"></i>&nbsp;Imprimer',
    '.do-randomize': 'Générer',
    '#empireTab': 'Empire Galactique',
    '#rebelTab': 'Alliance Rebelle',
    '#scumTab': 'Racailles & Scélérats',
    '#browserTab': 'Navigateur de cartes',
    '#aboutTab': 'À propos'
  },
  singular: {
    'pilots': 'Pilote',
    'modifications': 'Modification',
    'titles': 'Titre'
  },
  types: {
    'Pilot': 'Pilote',
    'Modification': 'Modification',
    'Title': 'Titre'
  }
};

if (exportObj.cardLoaders == null) {
  exportObj.cardLoaders = {};
}

exportObj.cardLoaders['Français'] = function() {
  var basic_cards, modification_translations, pilot_translations, title_translations, upgrade_translations;
  exportObj.cardLanguage = 'Français';
  basic_cards = exportObj.basicCardData();
  exportObj.canonicalizeShipNames(basic_cards);
  exportObj.ships = basic_cards.ships;
  exportObj.renameShip('TIE Fighter', 'Chasseur TIE');
  exportObj.renameShip('TIE Interceptor', 'Intercepteur TIE');
  exportObj.renameShip('TIE Defender', 'Défenseur TIE');
  exportObj.renameShip('TIE Phantom', 'TIE Fantôme');
  exportObj.renameShip('TIE Bomber', 'Bombardier TIE');
  exportObj.renameShip('Lambda-Class Shuttle', 'Navette de classe Lambda');
  exportObj.renameShip('VT-49 Decimator', 'Décimateur VT-49');
  exportObj.renameShip('Z-95 Headhunter', 'Chasseur de têtes Z-95');
  exportObj.renameShip('CR90 Corvette (Aft)', 'Corvette CR90 (poupe)');
  exportObj.renameShip('CR90 Corvette (Fore)', 'Corvette CR90 (proue)');
  exportObj.renameShip('GR-75 Medium Transport', 'Transport moyen GR-75');
  exportObj.renameShip('M3-A Interceptor', 'Intercepteur M3-A');
  pilot_translations = {
    "Academy Pilot": {
      ship: "Chasseur TIE",
      name: "Pilote de l'académie"
    },
    "Obsidian Squadron Pilot": {
      ship: "Chasseur TIE",
      name: "Pilote de l'escadron Obsidian"
    },
    "Black Squadron Pilot": {
      ship: "Chasseur TIE",
      name: "Pilote de l'escadron Noir"
    },
    '"Winged Gundark"': {
      ship: "Chasseur TIE",
      text: "Quand vous attaquez à portée 1, vous pouvez échanger 1 de vos résultats %HIT% contre 1 résultat %CRIT%."
    },
    '"Night Beast"': {
      ship: "Chasseur TIE",
      text: "Après avoir exécuté une manœuvre verte, vous pouvez effectuer une action de concentration gratuite."
    },
    '"Backstabber"': {
      ship: "Chasseur TIE",
      text: "Quand vous attaquez en dehors de l'arc de tir du défenseur, lancez 1 dé d'attaque supplémentaire."
    },
    '"Dark Curse"': {
      ship: "Chasseur TIE",
      text: "Quand vous défendez, les vaisseaux qui vous attaquent ne peuvent ni utiliser de marqueurs de concentration, ni relancer les dés d'attaque."
    },
    '"Mauler Mithel"': {
      ship: "Chasseur TIE",
      text: "Quand vous attaquez à portée 1, lancez 1 dé d'attaque supplémentaire."
    },
    '"Howlrunner"': {
      ship: "Chasseur TIE",
      text: "Quand un autre vaisseau allié situé à portée 1 attaque avec son arme principale, il peut relancer 1 dé d'attaque."
    },
    "Alpha Squadron Pilot": {
      name: "Pilote de l'escadron Alpha",
      ship: "Intercepteur TIE"
    },
    "Avenger Squadron Pilot": {
      name: "Pilote de l'escadron Avenger",
      ship: "Intercepteur TIE"
    },
    "Saber Squadron Pilot": {
      name: "Pilote de l'escadron Sabre",
      ship: "Intercepteur TIE"
    },
    "Royal Guard Pilot": {
      name: "Pilote de la Garde royale",
      ship: "Intercepteur TIE"
    },
    "\"Fel's Wrath\"": {
      name: "\"Colère de Fel\"",
      ship: "Intercepteur TIE",
      text: "Quand le nombre de cartes de dégâts qui vous est assigné est supérieur ou égal à votre valeur de coque, vous n'êtes pas détruit avant la fin de la phase de combat."
    },
    "Lieutenant Lorrir": {
      ship: "Intercepteur TIE",
      text: "Quand vous effectuez une action de tonneau, vous pouvez recevoir 1 marqueur de stress pour utiliser le gabarit (%BANKLEFT% 1) ou (%BANKRIGHT% 1) à la place du gabarit (%STRAIGHT% 1)."
    },
    "Kir Kanos": {
      ship: "Intercepteur TIE",
      text: "Quand vous attaquez à portée 2-3, vous pouvez dépenser 1 marqueur d'évasion pour ajouter 1 résultat %HIT% à votre jet."
    },
    "Tetran Cowall": {
      ship: "Intercepteur TIE",
      text: "Quand vous révélez une manœuvre %UTURN%, vous pouvez considérer la vitesse de celle-ci comme \"1\", \"3\" ou \"5\"."
    },
    "Turr Phennir": {
      ship: "Intercepteur TIE",
      text: "Après avoir effectué une attaque, vous pouvez effectuer une action gratuite d'accélération ou de tonneau."
    },
    "Carnor Jax": {
      ship: "Intercepteur TIE",
      text: "Les vaisseaux ennemis situés à portée 1 ne peuvent pas effectuer d'actions de concentration ou d'évasion, et ne peuvent pas dépenser de marqueur de concentration ou d'évasion."
    },
    "Soontir Fel": {
      ship: "Intercepteur TIE",
      text: "Quand vous recevez un marqueur de stress, vous pouvez assigner 1 marqueur de concentration à votre vaisseau."
    },
    "Sigma Squadron Pilot": {
      ship: "TIE Fantôme",
      name: "Pilote l'escadron Sigma"
    },
    "Shadow Squadron Pilot": {
      ship: "TIE Fantôme",
      name: "Pilote l'escadron Ombre"
    },
    '"Echo"': {
      ship: "TIE Fantôme",
      text: "Quand vous vous désoccultez, vous devez utiliser le gabarit (%BANKLEFT% 2) ou (%BANKRIGHT% 2) à la place du gabarit (%STRAIGHT% 2)."
    },
    '"Whisper"': {
      ship: "TIE Fantôme",
      text: "Après avoir effectué une attaque qui touche, vous pouvez assigner un marqueur de concentration à votre vaisseau."
    },
    "Onyx Squadron Pilot": {
      ship: "Défenseur TIE",
      name: "Pilote l'escadron Onyx"
    },
    "Delta Squadron Pilot": {
      ship: "Défenseur TIE",
      name: "Pilote l'escadron Delta"
    },
    "Colonel Vessery": {
      ship: "Défenseur TIE",
      text: "Quand vous attaquez, juste après avoir lancé les dés d'attaque, vous pouvez verrouiller le défenseur s'il a déjà un marqueur d'acquisition de cible rouge."
    },
    "Rexler Brath": {
      ship: "Défenseur TIE",
      text: "Après avoir effectué une attaque qui inflige au moins 1 carte de dégâts au défenseur, vous pouvez dépenser 1 marqueur de concentration pour retourner ces cartes face visible."
    },
    "Scimitar Squadron Pilot": {
      ship: "Bombardier TIE",
      name: "Pilote l'escadron Cimeterre"
    },
    "Gamma Squadron Pilot": {
      ship: "Bombardier TIE",
      name: "Pilote l'escadron Gamma"
    },
    "Captain Jonus": {
      ship: "Bombardier TIE",
      name: "Capitaine Jonus",
      text: "Quand un autre vaisseau allié situé à portée 1 attaque avec une arme secondaire, il peut relancer jusqu'à 2 dés d'attaque."
    },
    "Major Rhymer": {
      ship: "Bombardier TIE",
      text: "Quand vous attaquez avec une arme secondaire, vous pouvez augmenter ou réduire de 1 la portée de l'arme dans une limite de portée 1-3."
    },
    "Tempest Squadron Pilot": {
      name: "Pilote l'escadron Tempest"
    },
    "Storm Squadron Pilot": {
      name: "Pilote l'escadron Storm"
    },
    "Maarek Stele": {
      text: "Si votre attaque se solde par une carte de dégâts face visible pour le défenseur, piochez 3 cartes de dégâts, choisissez-en une que vous lui infligez et défaussez les autres."
    },
    "Darth Vader": {
      name: "Dark Vador",
      text: "Vous pouvez effectuer 2 actions lors de l'étape \"Effectuer une action\"."
    },
    "Commander Alozen": {
      text: "Au début de la phase de combat, vous pouvez verrouiller un vaisseu ennemi situé à portée 1."
    },
    "Bounty Hunter": {
      name: "Chasseur de primes"
    },
    "Kath Scarlet": {
      text: "Quand vous attaquez, le défenseur reçoit 1 marqueur de stress s'il annule au moins 1 résultat %CRIT%."
    },
    "Boba Fett": {
      text: "Quand vous révélez une manœuvre de virage sur l'aile (%BANKLEFT% ou %BANKRIGHT%), vous pouvez tourner votre cadran sur la manœuvre de virage sur l'aile opposée, à la même vitesse."
    },
    "Krassis Trelix": {
      text: "Quand vous attaquez avec une arme secondaire, vous pouvez relancer 1 dé d'attaque."
    },
    "Captain Kagi": {
      ship: "Navette de classe Lambda",
      name: "Capitaine Kagi",
      text: "Quand un vaisseau ennemi verrouille une cible, il doit verrouiller votre vaisseau, si possible."
    },
    "Colonel Jendon": {
      ship: "Navette de classe Lambda",
      text: "Au début de la phase de combat, vous pouvez assigner 1 de vos marqueurs d'acquisition de cible bleus à un vaisseau allié situé à portée 1 s'il n'a pas de marqueur d'acquisition de cible bleu."
    },
    "Captain Yorr": {
      ship: "Navette de classe Lambda",
      name: "Capitaine Yorr",
      text: "Quand un autre vaisseau allié situé à portée 1-2 est censé recevoir un marqueur de stress, vous pouvez le recevoir à sa place si vous n'avez pas déjà plus de 2 marqueurs de stress."
    },
    "Omicron Group Pilot": {
      ship: "Navette de classe Lambda",
      name: "Pilote du groupe Omicron"
    },
    "Captain Oicunn": {
      ship: "Décimateur VT-49",
      name: "Capitaine Oicunn",
      text: "Après avoir exécuté une manœuvre, chaque vaisseau ennemi avec lequel vous êtes au contact subit 1 dégât."
    },
    "Rear Admiral Chiraneau": {
      ship: "Décimateur VT-49",
      name: "Contre-Amiral Chiraneau",
      text: "Quand vous attaquez à portée 1-2, vous pouvez changer 1 de vos résultats %FOCUS% en résultat %CRIT%."
    },
    "Patrol Leader": {
      ship: "Décimateur VT-49",
      name: "Chef de Patrouille"
    },
    "Commander Kenkirk": {
      ship: "Décimateur VT-49",
      name: "Commandant Kenkirk",
      text: "Si vous n'avez pas de boucliers et qu'au moins 1 carte dégâts vous est assignée, augmentez de 1 votre valeur d'agilité."
    },
    "Juno Eclipse": {
      text: "When you reveal your maneuver, you may increase or decrease its speed by 1 (to a minimum of 1)."
    },
    "Zertik Strom": {
      text: "Enemy ships at Range 1 cannot add their range combat bonus when attacking."
    },
    "Lieutenant Colzet": {
      text: "At the start of the End phase, you may spend a target lock you have on an enemy ship to flip 1 random facedown Damage card assigned to it faceup."
    },
    "Red Squadron Pilot": {
      name: "Pilote de l'escadron Rouge"
    },
    "Rookie Pilot": {
      name: "Pilote débutant"
    },
    "Wedge Antilles": {
      text: "Quand vous attaquez, réduisez la valeur d'agilité du défenseur de 1 (jusqu'à un minimum de 0)."
    },
    "Garven Dreis": {
      text: "Après avoir utilisé un marqueur de concentration, vous pouvez placer ce dernier sur tout autre vaisseau allié situé à portée 1 ou 2 (plutôt que de le défausser)."
    },
    "Biggs Darklighter": {
      text: "Les autres vaisseaux alliés situés à portée 1 ne peuvent être les cibles d'attaques si l'assaillant est en mesure de vous attaquer à la place."
    },
    "Luke Skywalker": {
      text: "Quand vous défendez, vous pouvez échanger 1 de vos résultats %FOCUS% contre un résultat %EVADE%."
    },
    "Wes Janson": {
      text: "Après avoir effectué une attaque, vous pouvez retirer 1 marqueur de concentration, d'évasion ou d'acquisition de cible bleu au défenseur."
    },
    "Jek Porkins": {
      text: "Quand vous recevez un marqueur de stress, vous pouvez le retirer et lancer 1 dé d'attaque. Sur un résultat %HIT%, infligez 1 carte de dégâts face cachée à ce vaisseau."
    },
    '"Hobbie" Klivian': {
      text: "Quand vous effectuez ou dépensez une acquisition de cible, vous pouvez retirer 1 marqueur de stress de votre vaisseau."
    },
    "Tarn Mison": {
      text: "Quand un vaisseau ennemi vous déclare comme cible d'une attaque, vous pouvez le verrouiller."
    },
    "Gold Squadron Pilot": {
      name: "Pilote de l'escadron Or"
    },
    "Gray Squadron Pilot": {
      name: "Pilote de l'escadron Gris"
    },
    '"Dutch" Vander': {
      text: "Après avoir verrouillé une cible, choisissez un vaisseau allié situé à portée 1 ou 2. Cet autre vaisseau peut aussitôt verrouiller une cible."
    },
    "Horton Salm": {
      text: "Quand vous attaquez à portée 2 ou 3, vous pouvez relancer vos résultats vierges."
    },
    "Green Squadron Pilot": {
      name: "Pilote de l'escadron Vert"
    },
    "Prototype Pilot": {
      name: "Pilote sur prototype"
    },
    "Tycho Celchu": {
      text: "Vous pouvez effectuer des actions même quand vous avez des marqueurs de stress."
    },
    "Arvel Crynyd": {
      text: "Vous pouvez attaquer un vaisseau situé dans votre arc de tir, même si vos socles se touchent."
    },
    "Outer Rim Smuggler": {
      name: "Contrebandier de la Bordure extérieure"
    },
    "Chewbacca": {
      text: "Quand vous recevez une carte de dégâts face visible, retournez-là aussitôt face cachée (sans résoudre sa capacité)."
    },
    "Lando Calrissian": {
      text: "Après avoir exécuté une manœuvre verte, choisissez un autre vaisseau allié situé à portée 1. Ce vaisseau peut effectuer 1 action gratuite figurant dans sa barre d'action."
    },
    "Han Solo": {
      text: "Quand vous attaquez, vous pouvez relancer tous vos dés. Si vous décidez de le faire, vous devez relancer autant de vos dés que possible."
    },
    "Dagger Squadron Pilot": {
      name: "Pilote de l'escadron Dague"
    },
    "Blue Squadron Pilot": {
      name: "Pilote de l'escadron Bleu"
    },
    "Ten Numb": {
      text: "Quand vous attaquez ,1 de vos résultats %CRIT% ne peut pas être annulé par les dés de défense."
    },
    "Ibtisam": {
      text: "Quand vous attaquez ou défendez, si vous avez au moins 1 marqueur de stress, vous pouvez relancer un de vos dés."
    },
    "Rebel Operative": {
      name: "Agent rebelle"
    },
    "Roark Garnet": {
      text: 'Au début de la phase de combat, choisissez 1 autre vaisseau allié situé à portée 1-3. Jusqu\'à la fin de la phase, considérez que la valeur de pilotage de ce vaisseau est égale à 12.'
    },
    "Kyle Katarn": {
      text: "Au début de la phase de combat, vous pouvez assigner 1 de vos marqueurs de concentration à un autre vaisseau allié situé à portée 1-3."
    },
    "Jan Ors": {
      text: "Quand un autre vaisseau allié situé à portée 1-3 attaque, si vous n'avez aucun marqueur de stress, vous pouvez recevoir 1 marqueur de stress pour permettre à ce vaisseau de lancer 1 dé d'attaque supplémentaire."
    },
    "Bandit Squadron Pilot": {
      name: "Pilote de l'escadron Bandit",
      ship: "Chasseur de têtes Z-95"
    },
    "Tala Squadron Pilot": {
      name: "Pilote de l'escadron Tala",
      ship: "Chasseur de têtes Z-95"
    },
    "Lieutenant Blount": {
      ship: "Chasseur de têtes Z-95",
      text: "Quand vous attaquez, le défenseur est touché par votre attaque, même s'il ne subit pas de dégâts."
    },
    "Airen Cracken": {
      ship: "Chasseur de têtes Z-95",
      text: "Après avoir effectué une attaque, vous pouvez choisir un autre vaisseau allié situé à portée 1. Ce vaisseau peut effectuer une action gratuite."
    },
    "Knave Squadron Pilot": {
      name: "Pilote de l'escadron Valet"
    },
    "Blackmoon Squadron Pilot": {
      name: "Pilote de l'escadron Lune noire"
    },
    "Etahn A'baht": {
      text: "Quand un vaisseau ennemi située dans votre arc de tir et à portée 1-3 se défend, l'attaquant peut changer 1 des ses résultats %HIT% en résultat %CRIT%."
    },
    "Corran Horn": {
      text: "Au début de la phase de dénouement, vous pouvez effectuer une attaque. Vous ne pouvez pas attaquer au tour suivant."
    },
    "Jake Farrell": {
      text: "Après avoir effectué une action de concentration ou reçu un marqueur de concentration, vous pouvez effectuer une action gratuite d'accélération ou de tonneau."
    },
    "Gemmer Sojan": {
      text: "Tant que vous êtes à portée 1 d'au moins 1 vaisseau ennemi, augmentez de 1 votre valeur d'agilité."
    },
    "Keyan Farlander": {
      text: "Quand vous attaquez, vous pouvez retirer 1 marqueur de stress pour changer tous vos résultats %FOCUS% en résultats %HIT%."
    },
    "Nera Dantels": {
      text: "Vous pouvez effectuer des attaques d'arme secondaire %TORPEDO% contre des vaisseaux ennemis situés en dehors de votre arc de tir."
    },
    "GR-75 Medium Transport": {
      name: "Transport moyen GR-75",
      ship: "Transport moyen GR-75"
    },
    "CR90 Corvette (Fore)": {
      ship: "Corvette CR90 (proue)",
      name: "Corvette CR90 (proue)",
      text: "Quand vous attaquez avec votre arme principale, vous pouvez dépenser 1 énergie pour lancer 1 dé d'attaque supplémentaire."
    },
    "CR90 Corvette (Aft)": {
      ship: "Corvette CR90 (poupe)",
      name: "Corvette CR90 (poupe)"
    },
    "Dash Rendar": {
      text: "Vous pouvez ignorer les obstacles durant la phase d'activation et quand vous effectuez des actions."
    },
    '"Leebo"': {
      text: "Quand vous recevez une carte de dégâts face visible, piochez 1 carte de dégâts additionnelle ; choisissez-en 1 que vous résolvez et défaussez l'autre."
    },
    "Eaden Vrill": {
      text: "Quand vous effectuez une attaque d'arme principale contre un vaisseau sous l'effet du stress, lancez 1 dé d'attaque additionnel."
    },
    "Wild Space Fringer": {
      name: "Frontalier de l'espace sauvage"
    },
    "Prince Xizor": {
      text: "Quand vous défendez, un vaisseau allié à portée 1 peut subir 1 dégât %HIT% ou %CRIT% restant à votre place."
    },
    "Guri": {
      text: "Au début de la phase de combat, si vous êtes à portée 1 d'un vaisseau ennemi, vous pouvez assigner 1 marqueur de concentration à votre vaisseau."
    },
    "Black Sun Vigo": {
      name: "Vigo du Soleil Noir"
    },
    "Black Sun Enforcer": {
      name: "Homme de main du Soleil Noir"
    },
    "Cartel Spacer": {
      name: "Astropilote du Cartel",
      ship: "Intercepteur M3-A"
    },
    "Tansarii Point Veteran": {
      name: "Vétéran de Tansarii Point",
      ship: "Intercepteur M3-A"
    },
    "Serissu": {
      ship: "Intercepteur M3-A",
      text: "Quand un autre vaisseau allié à portée 1 défend, it peut relancer 1 dé de défense."
    },
    "Laetin A'shera": {
      ship: "Intercepteur M3-A",
      text: "Après avoir défendu contre une attaque, si cette dernière ne vous a pas touché, vous pouvez assigner 1 marqueur d'évasion à votre vaisseau."
    },
    "IG-88A": {
      text: "Après avoir effectué une attaque qui détruit le défenseur, vous pouvez récupérer 1 bouclier."
    },
    "IG-88B": {
      text: "Une fois par tour, après avoir effectué une attaque qui ne touche pas, vous pouvez effectuer une attaque avec une arme secondaire %CANON% équipée."
    },
    "IG-88C": {
      text: "Après avoir effectué une action d'accélération, vous pouvez effectuer une action d'évasion gratuite."
    },
    "IG-88D": {
      text: "Vous pouvez exécuter la manœuvre (%SLOOPLEFT% 3) ou (%SLOOPRIGHT% 3) en utilisant le gabarit (%TURNLEFT% 3) ou (%TURNRIGHT% 3) correspondant."
    },
    "Boba Fett (Scum)": {
      name: "Boba Fett (Racailles)",
      text: "Quand vous attaquez ou défendez, vous pouvez relancer 1 de vos dés pour chaque vaisseau ennemi à portée 1."
    },
    "Kath Scarlet (Scum)": {
      name: "Kath Scarlet (Racailles)",
      text: "Quand vous attaquez un vaisseau dans votre arc de tir auxiliaire, lancez 1 dé d'attaque supplémentaire."
    },
    "Emon Azzameen": {
      text: "Quand vous larguez une bombe, vous pouvez utiliser le gabarit [%TURNLEFT% 3], [%STRAIGHT% 3], ou [%TURNRIGHT% 3] au lieu du gabarit [%STRAIGHT% 1]."
    },
    "Mandalorian Mercenary": {
      name: "Mercenaire mandalorien"
    },
    "Kavil": {
      text: "Quand vous attaquez un vaisseau en dehors de votre arc de tir, lancez 1 dé d'attaque supplémentaire."
    },
    "Drea Renthal": {
      text: "Après avoir dépensé une acquisition de cible, vous pouvez recevoir 1 marqueur de stress pour verrouiller une cible."
    },
    "Hired Gun": {
      name: "Soudard"
    },
    "Syndicate Thug": {
      name: "Malfrat"
    },
    "Dace Bonearm": {
      text: "Quand un vaisseau ennemi situé à portée 1-3 reçoit au moins 1 marqueur ionique, si vous n'êtes pas déjà sous l'effet du stress, vous pouvez recevoir 1 marqueur de stress pour que ce vaisseau subisse 1 dégât."
    },
    "Palob Godalhi": {
      text: "Au début de la phase de combat, vous pouvez enlever 1 marqueur de concentration ou d'évasion d'un vaisseau ennemi situé à portée 1-2 et vous l'assigner."
    },
    "Torkil Mux": {
      text: "À la fin de la phase d'activation, choisissez 1 vaisseau ennemi situé à portée 1-2. Jusqu'à la fin de la phase de combat, considérez la valeur de pilotage de ce vaisseau égale \"0\"."
    },
    "Spice Runner": {
      name: "Trafiquant d'épice"
    },
    "Black Sun Soldier": {
      name: "Soldat du Soleil Noir",
      ship: "Chasseur de têtes Z-95"
    },
    "Binayre Pirate": {
      name: "Pirate Binayre",
      ship: "Chasseur de têtes Z-95"
    },
    "N'Dru Suhlak": {
      ship: "Chasseur de têtes Z-95",
      text: "Quand vous attaquez, s'il n'y a pas d'autres vaisseaux alliés à portée 1-2, lancez 1 dé d'attaque supplémentaire."
    },
    "Kaa'To Leeachos": {
      ship: "Chasseur de têtes Z-95",
      text: "Au début de la phase de combat, vous pouvez enlever 1 marqueur de concentration ou d'évasion d'un autre vaisseau allié situé à portée 1-2 et vous l'assigner."
    },
    "Latts Razzi": {
      text: "When a friendly ship declares an attack, you may spend a target lock you have on the defender to reduce its agility by 1 for that attack."
    },
    "Graz the Hunter": {
      text: "When defending, if the attacker is inside your firing arc, roll 1 additional defense die."
    },
    "Esege Tuketu": {
      text: "When another friendly ship at Range 1-2 is attacking, it may treat your focus tokens as its own."
    },
    '"Redline"': {
      text: "You may maintain 2 target locks on the same ship.  When you acquire a target lock, you may acquire a second lock on that ship."
    },
    '"Deathrain"': {
      text: "When dropping a bomb, you may use the front guides of your ship.  After dropping a bomb, you may perform a free barrel roll action."
    },
    "Moralo Eval": {
      text: "You can perform %CANNON% secondary attacks against ships inside your auxiliary firing arc."
    },
    'Gozanti-class Cruiser': {
      text: "After you execute a maneuver, you may deploy up to 2 attached ships."
    },
    '"Scourge"': {
      text: "When attacking a defender that has 1 or more Damage cards, roll 1 additional attack die."
    },
    "The Inquisitor": {
      text: "When attacking with your primary weapon at Range 2-3, treat the range of the attack as Range 1."
    },
    "Zuckuss": {
      text: "When attacking, you may roll 1 additional attack die.  If you do, the defender rolls 1 additional defense die."
    },
    "Dengar": {
      text: "Once per round after defending, if the attacker is inside your firing arc, you may perform an attack against the that ship."
    },
    "Poe Dameron": {
      text: "When attacking or defending, if you have a focus token, you may change 1 of your %FOCUS% results to a %HIT% or %EVADE% result."
    },
    '"Blue Ace"': {
      text: "When performing a boost action, you may use the (%TURNLEFT% 1) or (%TURNRIGHT% 1) template."
    },
    '"Omega Ace"': {
      text: "When attacking, you may spend a focus token and a target lock you have on the defender to change all of your results to %CRIT% results."
    },
    '"Epsilon Leader"': {
      text: "At the start of the Combat phase, remove 1 stress token from each friendly ship at Range 1."
    },
    '"Zeta Ace"': {
      text: "When performing a barrel roll you may use the (%STRAIGHT% 2) template instead of the (%STRAIGHT% 1) template."
    },
    '"Red Ace"': {
      text: 'The first time you remove a shield token from your ship each round, assign 1 evade token to your ship.'
    },
    '"Omega Leader"': {
      text: 'Enemy ships that you have locked cannot modify any dice when attacking you or defending against your attacks.'
    },
    'Hera Syndulla': {
      text: 'When you reveal a green or red maneuver, you may rotate your dial to another maneuver of the same difficulty.'
    },
    '"Youngster"': {
      text: "Friendly TIE fighters at Range 1-3 may perform the action on your equipped %ELITE% Upgrade card."
    },
    '"Wampa"': {
      text: "When attacking, you may cancel all die results.  If you cancel a %CRIT% result, deal 1 facedown Damage card to the defender."
    },
    '"Chaser"': {
      text: "When another friendly ship at Range 1 spends a focus token, assign a focus token to your ship."
    },
    'Ezra Bridger': {
      text: "When defending, if you are stressed, you may change up to 2 of your %FOCUS% results to %EVADE% results."
    },
    '"Zeta Leader"': {
      text: 'When attacking, if you are not stressed, you may receive 1 stress token to roll 1 additional die.'
    },
    '"Epsilon Ace"': {
      text: 'While you do not have any Damage cards, treat your pilot skill value as "12."'
    },
    "Kanan Jarrus": {
      text: "When an enemy ship at Range 1-2 is attacking, you may spend a focus token.  If you do, the attacker rolls 1 fewer attack die."
    },
    '"Chopper"': {
      text: "At the start of the Combat phase, each enemy ship you are touching receives 1 stress token."
    },
    'Hera Syndulla (Attack Shuttle)': {
      text: "When you reveal a green or red maneuver, you may rotate your dial to another maneuver of the same difficulty."
    },
    'Sabine Wren': {
      text: "Immediately before you reveal your maneuver, you may perform a free boost or barrel roll action."
    },
    '"Zeb" Orrelios': {
      text: 'When defending, you may cancel %CRIT% results before %HIT% results.'
    },
    'Tomax Bren': {
      text: 'Once per round, after you discard an %ELITE% Upgrade card, flip that card faceup.'
    },
    'Ello Asty': {
      text: 'While you are not stressed, you may treat your %TROLLLEFT% and %TROLLRIGHT% maneuvers as white maneuvers.'
    },
    "Valen Rudor": {
      text: "After defending, you may perform a free action."
    },
    "4-LOM": {
      text: "At the start of the End phase, you may assign 1 of your stress tokens to another ship at Range 1."
    },
    "Tel Trevura": {
      text: "The first time you would be destroyed, instead cancel any remaining damage, discard all Damage cards, and deal 4 facedown Damage cards to this ship."
    },
    "Manaroo": {
      text: "At the start of the Combat phase, you may assign all focus, evade, and target lock tokens assigned to you to another friendly ship."
    }
  };
  upgrade_translations = {
    "Determination": {
      name: "Détermination",
      text: "Quand vous recevez une carte de dégâts assortie du trait Pilote face visible, défaussez-la aussitôt (sans résoudre sa capacité)."
    },
    "Swarm Tactics": {
      name: "Tactique de nuée",
      text: "Au début de la phase de combat, choisissez 1 vaisseau allié situé à portée 1.%LINEBREAK%Jusqu'à la fin de cette phase, considérez que la valeur de pilotage du vaisseau en question est égale à la vôtre."
    },
    "Squad Leader": {
      name: "Chef d'escouade",
      text: "<strong>Action :</strong> choisissez 1 vaisseau situé à portée 1 ou 2 dont la valeur de pilotage est inférieure à la vôtre.%LINEBREAK%Ce vaisseau peut aussitôt effectuer 1 action gratuite."
    },
    "Expert Handling": {
      name: "As de l'espace",
      text: "<strong>Action :</strong> effectuez une <strong>action gratuite</strong> de tonneau. Si vous n'avez pas l'icône d'action %BARRELROLL%, recevez 1 marqueur de stress.%LINEBREAK%Ensuite, vous pouvez retirer 1 acquisition de cible ennemie de votre vaisseau."
    },
    "Marksmanship": {
      name: "Adresse au tir",
      text: "<strong>Action :</strong> en attaquant ce tour-ci, vous pouvez échanger 1 de vos résultats %FOCUS% contre 1 résultat %CRIT%, et tous vos autres résultats %FOCUS% contre des résultats %HIT%."
    },
    "Daredevil": {
      name: "Casse-cou",
      text: "<strong>Action :</strong> exécuter une manœuvre blanche (%TURNLEFT% 1) ou (%TURNRIGHT% 1).  Puis, recevez un marqueur de stress.%LINEBREAK%Ensuite, si vous n'avez pas l'icône d'action %BOOST%, lancez 2 dés d'attaque et subissez les dégâts (%HIT%) et les dégâts critiques (%CRIT%) obtenus."
    },
    "Elusiveness": {
      name: "Insaisissable",
      text: "Quand vous défendez, vous pouvez recevoir un marqueur de stress pour choisir 1 dé d'attaque.%LINEBREAK%Si vous avez au moins un marqueur de stress, vous ne pouvez pas utiliser cette capacité."
    },
    "Push the Limit": {
      name: "Repousser les limites",
      text: "Une fois par tour, après avoir effectué une action, vous pouvez effectuer 1 action gratuite figurant dans votre barre d'action.%LINEBREAK%Recevez ensuite un marqueur de stress."
    },
    "Deadeye": {
      name: "Tireur d'élite",
      text: "Vous pouvez considérer l'intitulé \"<strong>Attaque (acquisition de cible)</strong>\" comme un intitulé \"<strong>Attaque (concentration)</strong>\".%LINEBREAK%Quand une attaque vous demande d'utiliser un marqueur d'acquisition de cible, vous pouvez utiliser un marqueur de concentration à la place."
    },
    "Expose": {
      name: "Prise de risque",
      text: "<strong>Action :</strong> jusqu'à la fin du tour, augmentez votre valeur d'arme principale de 1 et réduisez votre valeur d'agilité de 1."
    },
    "Wingman": {
      name: "Ailier",
      text: "Au début de la phase de combat, retirez 1 marqueur de stress d'un autre vaisseau allié situé à portée 1."
    },
    "Decoy": {
      name: "Leurre",
      text: "Au début de la phase de combat, vous pouvez choisir 1 vaisseau allié situé à portée 1-2. Échangez votre valeur de pilotage avec celle de ce vaisseau jusqu'à la fin de la phase."
    },
    "Outmaneuver": {
      name: "Manœuvre improbable",
      text: "Quand vous attaquez un vaisseau situé dans votre arc de tir, si vous n'êtes pas dans l'arc de tir de ce vaisseau, réduisez sa valeur d'agilité de 1 (jusqu'à un minimum de 0)."
    },
    "Predator": {
      name: "Prédateur",
      text: "Quand vous attaquez, vous pouvez relancer 1 dé d'attaque. Si la valeur de pilote du défenseur est de \"2\" ou moins, vous pouvez relancer jusqu'à 2 dés d'attaque à la place."
    },
    "Draw Their Fire": {
      name: "Je les attire !",
      text: "Quand un vaisseau allié situé à portée 1 est touché par une attaque, vous pouvez subir 1 des résultats %CRIT% non annulés à la place de l'appareil visé."
    },
    "Adrenaline Rush": {
      name: "Montée d'adrénaline",
      text: "Quand vous révélez une manœuvre rouge, vous pouvez défausser cette carte pour traiter cette manœuvre comme une manœuvre blanche jusqu'à la fin de la phase d'activation."
    },
    "Veteran Instincts": {
      name: "Instinct de vétéran",
      text: "Augmentez votre valeur de pilotage de 2."
    },
    "Opportunist": {
      name: "Opportuniste",
      text: "Quand vous attaquez, si le défenseur n'a pas de marqueur de concentration ou d'évasion, vous pouvez recevoir 1 marqueur de stress pour lancer 1 dé d'attaque supplémentaire.%LINEBREAK%Vous ne pouvez pas utiliser cette capacité si vous avez au moins un marqueur de stress."
    },
    "Lone Wolf": {
      name: "Loup Solitaire",
      text: "Quand vous attaquez ou défendez, s'il n'y a pas de vaisseaux alliés à portée 1-2, vous pouvez relancer 1 de vos résultats vierges."
    },
    "Stay On Target": {
      name: "Restez en ligne",
      text: "Quand vous révélez une manœuvre, vous pouvez tourner votre cadran sur une autre manœuvre ayant la même vitesse.%LINEBREAK%Traitez cette manœuvre comme une manœuvre rouge."
    },
    "Ruthlessness": {
      name: "Impitoyable",
      text: "%FR_IMPERIALONLY%%LINEBREAK%Après avoir effectué une attaque qui touche, vous <strong>devez</strong> choisir 1 autre vaisseau situé à portée 1 du défenseur (autre que vous-même). Ce vaisseau subit 1 dégât."
    },
    "Intimidation": {
      text: "Tant que vous êtes au contact avec un vaisseau ennemi, réduisez de 1 la valeur d'agilité de ce vaisseau."
    },
    "Calculation": {
      name: "Calcul",
      text: "Quand vous attaquez, vous pouvez dépenser un marqueur de concentration pour changer 1 de vos résultats %FOCUS% en un résultat %CRIT%."
    },
    "Bodyguard": {
      name: "Garde du corps",
      text: "%FR_SCUMONLY%%LINEBREAK%Au début de la phase de combat, vous pouvez dépenser un marqueur de concentration pour choisir un vaisseau allié à portée 1 ayant une valeur de pilotage supérieure à la votre. Augmentez sa valeur d'agilité de 1 jusqu'à la fin du tour."
    },
    "R2 Astromech": {
      name: "Astromech R2",
      text: "Considérez toutes les manœuvres à vitesse 1 ou 2 comme des manœuvres vertes."
    },
    "R2-D2": {
      text: "Après avoir exécuté une manœuvre verte, vous pouvez récupérer 1 bouclier (sans pouvoir dépasser votre valeur de boucliers)."
    },
    "R2-F2": {
      text: "<strong>Action :</strong> augmentez votre valeur d'agilité de 1 jusqu'à la fin de ce tour."
    },
    "R5-D8": {
      text: "<strong>Action :</strong> lancez 1 dé de défense.%LINEBREAK%Sur un résultat %EVADE% ou %FOCUS%, défaussez 1 de vos cartes de dégâts face cachée."
    },
    "R5-K6": {
      text: "Après avoir utilisé votre acquisition de cible, lancez 1 dé de défense.%LINEBREAK%Sur un résultat %EVADE%, verrouillez aussitôt le même vaisseau. Vous ne pouvez cependant pas utiliser cette nouvelle acquisition de cible durant cette attaque."
    },
    "R5 Astromech": {
      name: "Astromech R5",
      text: "Pendant la phase de dénouement, choisissez une de vos cartes dégâts face visible assortie du trait <strong>Vaisseau</strong>, et retournez-la face cachée."
    },
    "R7 Astromech": {
      name: "Astromech R7",
      text: "Une fois par tour, quand vous défendez, si vous avez verrouillé l'attaquant, vous pouvez dépenser l'acquisition de cible pour choisir tout ou partie des dés d'attaque. L'attaquant doit relancer les dés choisis."
    },
    "R7-T1": {
      text: "<strong>Action :</strong> choisissez un vaisseau ennemi situé à portée 1-2. Si vous êtes dans son arc de tir, vous pouvez le verrouiller. Ensuite, vous pouvez effectuer une action d'accélération gratuite."
    },
    "R4-D6": {
      text: "Quand vous êtes touché par une attaque ayant généré au moins 3 résultats %HIT% non annulés, vous pouvez annuler les résultats que vous souhaitez jusqu'à ce qu'il n'en reste que 2. Pour chaque résultat annulé de la sorte, recevez 1 marqueur de stess."
    },
    "R5-P9": {
      text: "À la fin de la phase de combat, vous pouvez dépenser 1 de vos marqueurs de concentration pour récupérer 1 bouclier (jusqu'à concurrence de votre valeur de boucliers)."
    },
    "R3-A2": {
      text: "Quand vous déclarez la cible de votre attaque, si le défenseur est dans votre arc de tir, vous pouvez recevoir 1 marqueur de stress pour que le défenseur en reçoive 1 aussi."
    },
    "R2-D6": {
      text: "Votre bandeau d'amélioration gagne l'icône d'amélioration %ELITE%.%LINEBREAK%Vous ne pouvez pas équiper cette amélioration si vous avez déjà une icône d'amélioration %ELITE% ou si votre valeur de pilotage est de \"2\" ou moins."
    },
    "Proton Torpedoes": {
      name: "Torpilles à protons",
      text: "<strong>Attaque (acquisition de cible) :</strong> utilisez votre acquisition de cible et défaussez cette carte pour effectuer cette attaque.%LINEBREAK%Vous pouvez échanger 1 de vos résultats %FOCUS% contre 1 résultat %CRIT%."
    },
    "Advanced Proton Torpedoes": {
      name: "Torpilles à protons avancées",
      text: "<strong>Attaque (acquisition de cible) :</strong> utilisez votre acquisition de cible et défaussez cette carte pour effectuer cette attaque.%LINEBREAK%Vous pouvez échanger jusqu'à 3 de vos résultats vierge contre autant de résultats %FOCUS%."
    },
    "Flechette Torpedoes": {
      name: "Torpilles fléchettes",
      text: "<strong>Attaque (acquisition de cible) :</strong> défaussez cette carte et dépensez votre acquisition de cible pour effectuer cette attaque.%LINEBREAK%Après que vous avez effectué cette attaque, le défenseur reçoit 1 marqueur de stress si sa valeur de coque est de \"4\" ou moins."
    },
    "Ion Torpedoes": {
      name: "Torpilles ioniques",
      text: "<strong>Attaque (acquisition de cible) :</strong> utilisez votre acquisition de cible et défaussez cette carte pour effectuer cette attaque.%LINEBREAK%Si cette attaique touche, le défenseur et chaque vaisseau situé à portée 1 de celui-ci reçoit 1 marqueur ionique."
    },
    "Bomb Loadout": {
      name: "Chargement de bombes",
      text: "<span class=\"card-restriction\">Y-Wing uniquement. Limité.</span>%LINEBREAK%Votre bandeau d'amélioration gagne l'icone d'amélioration %BOMB%."
    },
    "Ion Cannon Turret": {
      name: "Tourelles à canons ioniques",
      text: "<strong>Attaque :</strong> attaquez 1 vaisseau (même s'il se situe en dehors de votre arc de tir).%LINEBREAK%Si cette attaque touche la cible, cette dernière subit 1 dégât et reçoit 1 marqueur ionique. Ensuite, annulez tous les résultats des dés."
    },
    "Blaster Turret": {
      name: "Tourelles blaster",
      text: "<strong>Attaque (concentration) :</strong> dépensez un marqueur concentration pour effectuer cette attaque contre 1 vaisseau (même s'il se situe en dehors de votre arc de tir)."
    },
    "Autoblaster Turret": {
      name: "Tourelle autoblaster",
      text: "<strong>Attaque :</strong> attaquez 1 vaisseau (même s'il se trouve en dehors de votre arc de tir).%LINEBREAK%Vos résultats %HIT% ne peuvent pas être annulés par des dés de défense. Le défenseur peut annuler les résultats %CRIT% avant les résultats %HIT%."
    },
    "Concussion Missiles": {
      name: "Missiles à concussion",
      text: "<strong>Attaque (acquisition de cible) :</strong> utilisez votre acquisition de cible et défaussez cette carte pour effectuer cette attaque.%LINEBREAK%Vous pouvez échanger 1 de vos résultats vierges contre 1 résultat %HIT%."
    },
    "Cluster Missiles": {
      name: "Missiles groupés",
      text: "<strong>Attaque (acquisition de cible) :</strong> utilisez votre acquisition de cible et défaussez cette carte pour effectuer cette attaque <strong>deux fois</strong>."
    },
    "Homing Missiles": {
      name: "Missiles à tête chercheuse",
      text: "<strong>Attaque (acquisition de cible) :</strong> défaussez cette carte pour effectuer cette attaque.%LINEBREAK%Le défenseur ne peut pas utiliser de marqueurs d'évasion durant cette attaque."
    },
    "Assault Missiles": {
      name: "Missiles d'assaut",
      text: "<strong>Attaque (acquisition de cible) :</strong> utilisez votre acquisition de cible et défaussez cette carte pour effectuer cette attaque.%LINEBREAK%Si cette attaque touche, chaque vaisseau situé à portée 1 du défenseur subit 1 dégât."
    },
    "Ion Pulse Missiles": {
      name: "Missiles à pulsations ioniques",
      text: "<strong>Attaque (acquisition de cible) :</strong> défaussez cette carte pour effectuer cette attaque.%LINEBREAK%Si cette attaque touche, le défenseur subit 1 dégât et reçoit 2 marqueurs ioniques. Ensuite, annulez le résultat de <strong>tous<strong> les dés."
    },
    "Chardaan Refit": {
      name: "Radoub à Chardaan",
      text: "<span class=\"card-restriction\">A-Wing uniquement.</span>%LINEBREAK%Cette carte a un coût en points d'escadron négatif."
    },
    "Proton Rockets": {
      name: "Roquettes à proton",
      text: "<strong>Attaque (concentration) :</strong> défaussez cette carte pour effectuer cette attaque.%LINEBREAK%Vous pouvez lancer un nombre de dés d'attaque additionnels égal à votre valeur d'agilité, jusqu'à un maximum de 3 dés additionnels."
    },
    "Seismic Charges": {
      name: "Charges sismiques",
      text: "Quand vous révélez votre cadran de manoeuvres, vous pouvez défausser cette carte pour  <strong>larguer</strong> 1 marqueur de charges sismiques.%LINEBREAK%Ce marqueur <strong>explose</strong> à la fin de la phase d'activation."
    },
    "Proximity Mines": {
      name: "Mines de proximité",
      text: "<strong>Action :</strong> défaussez cette carte pour <strong>larguer</strong> 1 marqueur de mines de proximité. Quand un vaisseau exécute une manœuvre, si son socle ou son gabarit de manœuvre chevauche ce marqueur, ce marqueur <strong>explose</strong>."
    },
    "Proton Bombs": {
      name: "Bombes à protons",
      text: "Quand vous révélez votre cadran de manoeuvres, vous pouvez défausser cette carte pour <strong>larguer</strong> 1 marqueur de bombe à protons.%LINEBREAK%Ce marqueur <strong>explose</strong> à la fin de la phase d'activation."
    },
    "Ion Cannon": {
      name: "Canon ionique",
      text: "<strong>Attaque :</strong> Attaque : attaquez 1 vaisseau.%LINEBREAK%Si cette attaque touche, le défenseur subit 1 dégât et reçoit 1 marqueur ionique. Ensuite annulez le résultat de tous les dés."
    },
    "Heavy Laser Cannon": {
      name: "Canon laser lourd",
      text: "<strong>Attaque :</strong> attaquez 1 vaisseau.%LINEBREAK%Juste après avoir lancé vos dés d'attaque, vous devez changer tous vos résultats %CRIT% en résultats %HIT%."
    },
    "Autoblaster": {
      text: "<strong>Attaque :</strong> attaquez 1 vaisseau.%LINEBREAK%Vos résultats %HIT% ne peuvent pas être annulés par des dés de défense. Le défenseur peut annuler les résultats %CRIT% avant les résultats %HIT%."
    },
    "Flechette Cannon": {
      name: "Canon à fléchettes",
      text: "<strong>Attaque :</strong> Attaquez 1 vaisseau.%LINEBREAK%Si cette attaque touche, le défenseur subit 1 dégât et, si le défenseur n'est pas sous l'effet du stress, il reçoit aussi 1 marqueur de stress. Ensuite, annulez le résultat de <strong>tous</strong> les dés."
    },
    '"Mangler" Cannon': {
      name: "Canon \"Lacérateur\"",
      text: "<strong>Attaque :</strong> Attaquez 1 vaisseau.%LINEBREAK% Quand vous attaquez, vous pouvez échanger 1 de vos résultats %HIT% contre 1 résultat %CRIT%."
    },
    "Enhanced Scopes": {
      name: "Radars améliorés",
      text: "Durant la phase d'activation, considérez que votre valeur de pilotage est égale à \"0\"."
    },
    "Fire-Control System": {
      name: "Système de commande de tir",
      text: "Après avoir effectué une attaque, vous pouvez verrouiller le défenseur."
    },
    "Advanced Sensors": {
      name: "Senseurs avancés",
      text: "Juste avant de révéler votre manoeuvre, vous pouvez effectuer 1 action gratuite.%LINEBREAK%Si vous utilisez cette capacité, vous devez passer l'étape \"Effectuer une action\" ce tour-ci."
    },
    "Sensor Jammer": {
      name: "Brouilleur de senseurs",
      text: "Quand vous défendez, vous pouvez changer un des résultats %HIT% de l'attaquant en résultat %FOCUS%. L'attaquant ne peut pas relancer le dés au résultat modifié."
    },
    "Accuracy Corrector": {
      name: "Correcteur de Précision",
      text: "Quand vous attaquez, vous pouvez annuler le résultat de tous vos dés. Puis, vous pouvez ajouter 2 résultats %HIT%.%LINEBREAK%Vos dés ne peuvent pas être modifiés à nouveau lors de cette attaque."
    },
    "Gunner": {
      name: "Cannonier",
      text: "Après avoir effectué une attaque qui ne touche pas, vous pouvez effectuer immédiatement une attaque d'arme principale. Vous ne pouvez pas effectuer d'autre attaque ce tour-ci."
    },
    "Mercenary Copilot": {
      name: "Copilote mercenaire",
      text: "Quand vous attaquez à portée 3, vous pouvez échanger 1 de vos résultats %HIT% contre 1 résultat %CRIT%."
    },
    "Weapons Engineer": {
      name: "Ingénieur en armement",
      text: "Vous pouvez verrouiller 2 cibles (1 seule acquisition de cible par vaisseau ennemi).%LINEBREAK%Quand vous verrouillez une cible, vous pouvez verrouiller 2 vaisseaux différents."
    },
    "Luke Skywalker": {
      text: "%FR_REBELONLY%%LINEBREAK%Quand vous effectuez une attaque qui ne touche pas, effectuez aussitôt une attaque d'arme principale. Vous pouvez échanger un résultat %FOCUS% contre 1 résultat %HIT%. Vous ne pouvez pas effectuer d'autre attaque ce tour-ci."
    },
    "Nien Nunb": {
      text: "%FR_REBELONLY%%LINEBREAK%Vous pouvez traiter toute les manœuvres %STRAIGHT% comme des manœuvres vertes."
    },
    "Chewbacca": {
      text: "%FR_REBELONLY%%LINEBREAK%Quand vous recevez une carte de dégâts, vous pouvez la défaussez sur-le-champs et récupérer 1 bouclier. Ensuite, défaussez cette carte d'amélioration."
    },
    "Recon Specialist": {
      name: "Officier en reconnaissance",
      text: "Quand vous effectuez une action de concentration, assignez 1 marqueur de concentration supplémentaire à votre vaisseau."
    },
    "Saboteur": {
      text: "<strong>Action :</strong> choisissez 1 vaisseau ennemi situé à portée 1 et lancez 1 dé d'attaque. Sur un résultat %HIT% ou %CRIT%, choisissez au hasard une carte de dégâts face cachée assignée à ce vaisseau, retrounez-la et résolvez-la."
    },
    "Intelligence Agent": {
      name: "Agent de renseignements",
      text: "Au début de la phase d'activation, choisissez 1 vaisseau ennemi situé à portée 1-2. Vous pouvez regarder la manoeuvre choisie pour ce vaisseau."
    },
    "Darth Vader": {
      name: "Dark Vador",
      text: "%FR_IMPERIALONLY%%LINEBREAK%Après avoir effectué une attaque contre un vaisseau ennemi, vous pouvez subir 2 dégâts pour infliger 1 dégât critique à cet appareil."
    },
    "Rebel Captive": {
      name: "Prisonnier rebelle",
      text: "%FR_IMPERIALONLY%%LINEBREAK%Une fois par tour, le premier vaisseau qui vous déclare comme la cible d'une attaque reçoit aussitôt 1 marqueur de stress."
    },
    "Flight Instructor": {
      name: "Pilote instructeur",
      text: "Quand vous défendez, vous pouvez relancer 1 de vos résultats %FOCUS%. Si la valeur de pilotage de l'attaquant est de 2 ou moins, vous pouvez relancer 1 de vos résultats vierges à la place."
    },
    "Navigator": {
      name: "Navigateur",
      text: "Quand vous révélez une manoeuvre, vous pouvez tourner le cadran sur une autre manoeuvre ayant la même direction.%LINEBREAK%Vous ne pouvez pas tourner le cadran sur une manoeuvre rouge si vous avez au moins un marqueurs de stress."
    },
    "Lando Calrissian": {
      text: "%FR_REBELONLY%%LINEBREAK%<strong>Action :</strong> lancez 2 dés de défense. Pour chaque résultat %FOCUS%, assignez 1 marqueur de concentration à votre vaisseau. Pour chaque résultat %EVADE%, assignez 1 marqueur d'évasion à votre vaisseau."
    },
    "Mara Jade": {
      text: "%FR_IMPERIALONLY%%LINEBREAK%À la fin de la phase de combat, chaque vaisseau ennemi situé à portée 1 qui n'a pas de marqueur de stress reçoit 1 marqueur de stress."
    },
    "Fleet Officer": {
      name: "Officier de la flotte",
      text: "%FR_IMPERIALONLY%%LINEBREAK%<strong>Action :</strong> choisissez jusqu'à 2 vaisseaux alliés situés à portée 1-2 et assignez 1 marqueur de concentration à chacun d'eux. Ensuite, recevez 1 marqueur de stress."
    },
    "Han Solo": {
      text: "%FR_REBELONLY%%LINEBREAK%Quand vous attaquez, si vous avez verrouillé le défenseur, vous pouvez dépenser ce marqueur d'acquisition de cible pour changer tous vos résultats %FOCUS% en résultats %HIT%."
    },
    "Leia Organa": {
      text: "%FR_REBELONLY%%LINEBREAK%Au début de la phase d'activation, vous pouvez défausser cette carte pour permettre à tous les vaisseaux alliés qui dévoilent une manœuvre rouge de considérer cette dernière comme une manœuvre blanche jusqu'à la fin de la phase."
    },
    "WED-15 Repair Droid": {
      name: "Droïde de réparation WED-15",
      text: "%FR_HUGESHIPONLY% %FR_REBELONLY%%LINEBREAK%<strong>Action :</strong> dépensez 1 énergie pour défausser 1 de vos cartes de dégâts face cachée, ou dépensez 3 énergie pour défausser 1 de vos cartes de dégâts face visible."
    },
    "Carlist Rieekan": {
      text: "%FR_HUGESHIPONLY% %FR_REBELONLY%%LINEBREAK%Au début de la phase d'activation, vous pouvez défausser cette carte pour traiter la valeur de pilotage de chaque vaisseau allié comme si elle s'élevait à \"12\", jusqu'à la fin de la phase."
    },
    "Jan Dodonna": {
      text: "%FR_HUGESHIPONLY% %FR_REBELONLY%%LINEBREAK%Quand un autre vaisseau allié situé à portée 1 attaque, il peut échanger 1 de ses résultats %HIT% contre un résultat %CRIT%."
    },
    "Tactician": {
      name: "Tacticien",
      text: "Après que vous avez effectué une attaque contre un vaisseau situé dans votre arc de tir à portée 2, ce vaisseau reçoit 1 marqueur de stress."
    },
    "R2-D2 (Crew)": {
      name: "R2-D2 (Équipage)",
      text: "%FR_REBELONLY%%LINEBREAK%À la fin de la phase de dénouement, si vous n'avez pas de boucliers, vous pouvez récupérer 1 bouclier et lancer 1 dé d'attaque. Sur un résultat %HIT%, prenez au hasard 1 de vos cartes de dégâts face cachée, retournez-la et résolvez-la."
    },
    "C-3PO": {
      name: "Z-6PO",
      text: "%FR_REBELONLY%%LINEBREAK%Une fois par tour, avant de lancer 1 ou plusieurs dés de défense, vous pouvez tenter d'en deviner à voix haute le nombre de résultats %EVADE%. Si vous obtenez le nombre annoncé (avant de modifier des dés), ajoutez 1 résultat %EVADE%."
    },
    "Kyle Katarn": {
      text: "%FR_REBELONLY%%LINEBREAK%Après avoir retiré un marqueur stress de votre vaisseau, vous pouvez assigner un marqueur concentration à votre vaisseau."
    },
    "Jan Ors": {
      text: "%FR_REBELONLY%%LINEBREAK%Une fois par tour, quand un vaisseau allié à portée 1-3 effectue une action de concentration ou reçoit un marqueur de concentration, vous pouvez assigner un marqueur d'évasion à la place."
    },
    "Toryn Farr": {
      text: "%FR_HUGESHIPONLY% %FR_REBELONLY%%LINEBREAK%<strong>Action :</strong> dépensez n'importe quelle quantité d'énergie pour choisir autant de vaisseaux ennemis situés à portée 1-2. Retirez tous les marqueurs de concentratino, d'évasion et d'acquisition de cible bleus de ces vaisseaux."
    },
    "Targeting Coordinator": {
      name: "Coordinateur de visée",
      text: "<strong>Énergie :</strong> vous pouvez dépenser 1 énergie pour choisir un vaisseau allié situé à portée 1-2. Verrouillez une cible, puis assignez le marqueur d'acquisition de cible bleu au vaisseau choisi."
    },
    "Raymus Antilles": {
      text: "%FR_HUGESHIPONLY% %FR_REBELONLY%%LINEBREAK%Au début de la phase d'activation, choisissez 1 vaisseau ennemi situé à portée 1-3. Vous pouvez regarder la manœuvre choisie pour ce vaisseau. Si la manœuvre est blanche, assignez 1 marqueur de stress à ce vaisseau."
    },
    '"Leebo"': {
      text: "<strong>Action :</strong> Effectuez une action d'accélération gratuite. Ensuite, recevez 1 marqueur ionique."
    },
    "Dash Rendar": {
      text: "%FR_REBELONLY%%LINEBREAK%Vous pouvez effectuer des attaques tout en chevauchant un obstacle.%LINEBREAK%Vos attaques ne peuvent pas être gênées."
    },
    "Ysanne Isard": {
      text: "%FR_IMPERIALONLY%%LINEBREAK%Au début de la phase de combat, si vous n'avez pas de boucliers et qu'au moins 1 carte de dégâts est assignée à votre vaisseau, vous pouvez effectuer une action d'évasion gratuite."
    },
    "Moff Jerjerrod": {
      text: "%FR_IMPERIALONLY%%LINEBREAK%Quand vous recevez une carte de dégâts face visible, vous pouvez défausser cette carte d'amélioration ou une autre carte d'amélioration %CREW% pour retourner cette carte dégâts face cachée (sans en résoudre l'effet)."
    },
    "Greedo": {
      text: "%FR_SCUMONLY%%LINEBREAK%La première fois que vous attaquez à chaque tour et la première fois que vous défendez à chaque tour, la première carte dégâts infligée l'est face visible."
    },
    "Outlaw Tech": {
      name: "Technicien hors la loi",
      text: "Après avoir exécuté une manœuvre rouge, vous pouvez assigner 1 marqueur de concentration à votre vaisseau."
    },
    "Frequency Jammer": {
      name: "Brouilleurs de fréquence",
      text: "Quand vous effectuez une action de brouillage, choisissez 1 vaisseau ennemi qui n'a pas de marqueur de stress et se situe à portée 1 du vaisseau brouillé. Le vaisseau choisi reçoit 1 marqueur de stress."
    },
    "Expanded Cargo Hold": {
      ship: "Transport moyen GR-75",
      name: "Compartiments supplémentaires",
      text: "<span class=\"card-restriction\">GR-75 uniquement.</span>%LINEBREAK%Une fois par tour, quand vous êtes censé recevoir une carte de dégâts face visible, vous pouvez la piocher dans le paquet de dégâts de poupe ou de proue."
    },
    "Comms Booster": {
      name: "Amplificateur Comm",
      text: "<strong>Énergie :</strong> dépensez 1 énergie pour retirer tous les marqueurs de stress d'un vaisseau allié situé à portée 1-3. Ensuite, assignez 1 marqueur de concentration à ce vaisseau."
    },
    "Slicer Tools": {
      name: "Outils de slicer",
      text: "<strong>Action :</strong> choisissez 1 ou plusieurs vaisseaux ennemis situés à portée 1-3 ayant un marqueur de stress. Pour chaque vaisseau choisi, vous pouvez dépenser 1 énergie pour forcer ce vaisseau à subir 1 dégât."
    },
    "Shield Projector": {
      name: "Projecteur de boucliers",
      text: "Quand un vaisseau ennemi devient le vaisseau actif durant la phase de combat, vous pouvez dépenser 3 énergie pour l'obliger à vous attaquer, si possible, jusqu'à la fin de la phase."
    },
    "Tibanna Gas Supplies": {
      name: "Réserves de gaz Tibanna",
      text: "<strong>Énergie :</strong> vous pouvez défausser cette carte pour gagner 3 énergie."
    },
    "Ionization Reactor": {
      name: "Réacteur à ionisation",
      text: "<strong>Énergie :</strong> dépensez 5 énergie de cette carte et défaussez-la pour que chaque autre vaisseau situé à portée 1 subisse 1 dégât et reçoive un marqueur ionique."
    },
    "Engine Booster": {
      name: "Booster",
      text: "Juste avant de dévoiler votre cadran de manœuvres, vous pouvez dépenser 1 énergie pour exécuter une manœuvre (%STRAIGHT%) blanche. Vous ne pouvez pas utiliser cette capacité si elle vous fait chevaucher un autre vaisseau."
    },
    "Backup Shield Generator": {
      name: "Générateur de boucliers auxiliaire",
      text: "À la fin de chaque tour, vous pouvez dépenser 1 énergie pour récupérer 1 bouclier (jusqu'à concurrence de votre valeur de boucliers)."
    },
    "EM Emitter": {
      name: "Émetteur EM",
      text: "Quand vous gênez une attaque, le défenseur lance 3 dés de défense supplémentaires (au lieu de 1)."
    },
    "Ion Cannon Battery": {
      text: "<strong>Attaque (énergie):</strong> Dépensez 2 énergie de cette carte pour effectuer une attaque. Si cette attaque touche, le défenseur subit 1 dégât critique et reçoit 1 marqueur inioque. Puis annulez <strong>tous</strong> les résultats des dés."
    },
    "Single Turbolasers": {
      name: "Turbolaser",
      text: "<strong>Attaque (énergie) :</strong> dépensez 2 énergie de cette carte pour effectuer cette attaque. Le défenseur double sa valeur d'agilité contre cette attaque. Vous pouvez changer 1 de vos résultats %FOCUS% en résultat %HIT%."
    },
    "Quad Laser Cannons": {
      name: "Canons quadrilaser",
      text: "<strong>Attaque (énergie) :</strong> dépensez 1 énergie de cette carte pour effectuer cette attaque. Si cette attaque ne touche pas, vous pouvez aussitôt dépenser 1 énergie de cette carte pour effectuer à nouveau cette attaque."
    },
    "Gunnery Team": {
      name: "Équipe d'artilleurs",
      text: "Une fois par tour, quand vous attaquez avec une arme secondaire, vous pouvez dépenser 1 énergie pour change 1 de vos résultats vierges en résultat %HIT%."
    },
    "Sensor Team": {
      name: "Équipe des senseurs",
      text: "Quand vous verrouillez une cible, vous pouvez verrouiller un vaisseau ennemi à portée 1-5 (au lieu de portée 1-3)."
    },
    "Engineering Team": {
      name: "Équipe de mécaniciens",
      text: "Durant la phase d'activation, quand vous dévoilez une manœuvre %STRAIGHT%, gagnez 1 énergie supplémentaire lors de l'étape \"Gagner de l'énergie\"."
    },
    "Inertial Dampeners": {
      name: "Amortisseurs inertiels",
      text: "Quand vous révélez votre cadran de manœuvre, vous pouvez défausser cette carte pour exécuter une manœuvre blanche [0%STOP%] à la place. Ensuite, recevez 1 marqueur de stress."
    },
    "Dead Man's Switch": {
      name: "Salve automatique",
      text: "Quand vous êtes détruit, chaque vaisseau à portée 1 subit 1 dégât."
    },
    "Feedback Array": {
      name: "Dispositif de retour",
      text: "Lors de la phase de combat, au lieu d'effectuer des attaques, vous pouvez recevoir 1 marqueur ionique et subit 1 dégât pour choisir un vaisseau ennemi à portée 1. Ce vaisseau subit 1 dégât."
    },
    '"Hot Shot" Blaster': {
      name: "Blaster \"de la mort\"",
      text: "<strong>Attaque :</strong> défaussez cette carte pour attaquer 1 vaisseau (même s'il est en dehors de votre arc de tir)."
    },
    "Salvaged Astromech": {
      name: "Atromech récupéré",
      text: "Quand vous recevez une carte de dégâts ayant le trait <strong>Vaisseau</strong>, vous pouvez immédiatement la défausser (avant d'en résoudre l'effet).%LINEBREAK%Puis, défaussez cette carte d'amélioration."
    },
    '"Genius"': {
      name: "Génie",
      text: "Si vous êtes équipé d'une bombe qui peut être larguée avant que vous ne révéliez votre manœuvre, vous pouvez au lieu de cela larguer la bombe <strong>après</strong> avoir éxecuté votre manœuvre."
    },
    "Unhinged Astromech": {
      name: "Atromech déglingué",
      text: "Vous pouvez considérer toutes les manœuvres de vitesse 3 comme manœuvres vertes."
    },
    "R4-B11": {
      text: "Quand vous attaquez, si vous avez verrouillé le défenseur, vous pouvez dépenser l'acquisition de cible pour choisir tout ou partie des dés de défense. Le défenseur doit relancer les dés choisis."
    },
    "R4 Agromech": {
      name: "Astromech R4",
      text: "Quand vous attaquez, après avoir dépensé un marqueur de concentration, vous pouvez verrouiller le défenseur."
    },
    "K4 Security Droid": {
      name: "Droïde de sécurité K4",
      text: "%FR_SCUMONLY%%LINEBREAK%Après avoir exécuté une manœuvre verte, vous pouvez verrouiller cible."
    },
    "Advanced Targeting Computer": {
      text: "<span class=\"card-restriction\">TIE Advanced uniquement.</span>%LINEBREAK%Quand vous attaquez avec votre arme principale, si vous avez verrouillé le défenseur, vous pouvez ajouter un résultat %CRIT% result à votre lancer de dés. Si vous le faîtes, vous ne pouvez pas dépenser de marqueur d'acquisition de cible durant cette attaque."
    },
    "Emperor Palpatine": {
      text: "%IMPERIALONLY%%LINEBREAK%Once per round, you may change a friendly ship's die result to any other die result.  That die result cannot be modified again."
    },
    "Bossk": {
      text: "%SCUMONLY%%LINEBREAK%After you perform an attack that does not hit, if you are not stressed, you <strong>must</strong> receive 1 stress token. Then assign 1 focus token to your ship and acquire a target lock on the defender."
    },
    "Lightning Reflexes": {
      text: "%SMALLSHIPONLY%%LINEBREAK%After you execute a white or green maneuver on your dial, you may discard this card to rotate your ship 180&deg;.  Then receive 1 stress token <strong>after</strong> the \"Check Pilot Stress\" step."
    },
    "Twin Laser Turret": {
      text: "<strong>Attack:</strong> Perform this attack <strong>twice</strong> (even against a ship outside your firing arc).<br /><br />Each time this attack hits, the defender suffers 1 damage.  Then cancel <strong>all</strong> dice results."
    },
    "Plasma Torpedoes": {
      text: "<strong>Attack (target lock):</strong> Spend your target lock and discard this card to perform this attack.<br /><br />If this attack hits, after dealing damage, remove 1 shield token from the defender."
    },
    "Ion Bombs": {
      text: "When you reveal your maneuver dial, you may discard this card to <strong>drop</strong> 1 ion bomb token.<br /><br />This token <strong>detonates</strong> at the end of the Activation phase.<br /><br /><strong>Ion Bombs Token:</strong> When this bomb token detonates, each ship at Range 1 of the token receives 2 ion tokens.  Then discard this token."
    },
    "Conner Net": {
      text: "<strong>Action:</strong> Discard this card to <strong>drop</strong> 1 Conner Net token.<br /><br />When a ship's base or maneuver template overlaps this token, this token <strong>detonates</strong>.<br /><br /><strong>Conner Net Token:</strong> When this bomb token detonates, the ship that moved through or overlapped this token suffers 1 damage, receives 2 ion tokens, and skips its \"Perform Action\" step.  Then discard this token."
    },
    "Bombardier": {
      text: "When dropping a bomb, you may use the (%STRAIGHT% 2) template instead of the (%STRAIGHT% 1) template."
    },
    "Cluster Mines": {
      text: "<strong>Action:</strong> Discard this card to <strong>drop</strong> 3 cluster mine tokens.<br /><br />When a ship's base or maneuver template overlaps a cluster mine token, that token <strong>detonates</strong>.<br /><br /><strong>Cluster Mines Tokens:</strong> When one of these bomb tokens detonates, the ship that moved through or overlapped this token rolls 2 attack dice and suffers all damage (%HIT%) rolled.  Then discard this token."
    },
    'Crack Shot': {
      text: 'When attacking a ship inside your firing arc, you may discard this card to cancel 1 of the defender\'s %EVADE% results.'
    },
    "Advanced Homing Missiles": {
      text: "<strong>Attack (target lock):</strong> Discard this card to perform this attack.%LINEBREAK%If this attack hits, deal 1 faceup Damage card to the defender.  Then cancel <strong>all</strong> dice results."
    },
    'Agent Kallus': {
      text: '%IMPERIALONLY%%LINEBREAK%At the start of the first round, choose 1 enemy small or large ship.  When attacking or defending against that ship, you may change 1 of your %FOCUS% results to a %HIT% or %EVADE% result.'
    },
    'XX-23 S-Thread Tracers': {
      text: "<strong>Attack (focus):</strong> Discard this card to perform this attack.  If this attack hits, each friendly ship at Range 1-2 of you may acquire a target lock on the defender.  Then cancel <strong>all</strong> dice results."
    },
    "Tractor Beam": {
      text: "<strong>Attack:</strong> Attack 1 ship.%LINEBREAK%If this attack hits, the defender receives 1 tractor beam token.  Then cancel <strong>all</strong> dice results."
    },
    "Cloaking Device": {
      text: "%SMALLSHIPONLY%%LINEBREAK%<strong>Action:</strong> Perform a free cloak action.%LINEBREAK%At the end of each round, if you are cloaked, roll 1 attack die.  On a %FOCUS% result, discard this card, then decloak or discard your cloak token."
    },
    "Shield Technician": {
      text: "%HUGESHIPONLY%%LINEBREAK%When you perform a recover action, instead of spending all of your energy, you can choose any amount of energy to spend."
    },
    "Weapons Guidance": {
      text: "When attacking, you may spend a focus token to change 1 of your blank results to a %HIT% result."
    },
    "BB-8": {
      text: "When you reveal a green maneuver, you may perform a free barrel roll action."
    },
    "R5-X3": {
      text: "Before you reveal your maneuver, you may discard this card to ignore obstacles until the end of the round."
    },
    "Wired": {
      text: "When attacking or defending, if you are stressed, you may reroll 1 or more of your %FOCUS% results."
    },
    'Cool Hand': {
      text: 'When you receive a stress token, you may discard this card to assign 1 focus or evade token to your ship.'
    },
    'Juke': {
      text: '%SMALLSHIPONLY%%LINEBREAK%When attacking, if you have an evade token, you may change 1 of the defender\'s %EVADE% results into a %FOCUS% result.'
    },
    'Comm Relay': {
      text: 'You cannot have more than 1 evade token.%LINEBREAK%During the End phase, do not remove an unused evade token from your ship.'
    },
    'Dual Laser Turret': {
      text: '%GOZANTIONLY%%LINEBREAK%<strong>Attack (energy):</strong> Spend 1 energy from this card to perform this attack against 1 ship (even a ship outside your firing arc).'
    },
    'Broadcast Array': {
      text: '%GOZANTIONLY%%LINEBREAK%Your action bar gains the %JAM% action icon.'
    },
    'Rear Admiral Chiraneau': {
      text: '%HUGESHIPONLY% %IMPERIALONLY%%LINEBREAK%<strong>Action:</strong> Execute a white (%STRAIGHT% 1) maneuver.'
    },
    'Ordnance Experts': {
      text: 'Once per round, when a friendly ship at Range 1-3 performs an attack with a %TORPEDO% or %MISSILE% secondary weapon, it may change 1 of its blank results to a %HIT% result.'
    },
    'Docking Clamps': {
      text: '%GOZANTIONLY% %LIMITED%%LINEBREAK%You may attach 4 up to TIE fighters, TIE interceptors, TIE bombers, or TIE Advanced to this ship.  All attached ships must have the same ship type.'
    },
    '"Zeb" Orrelios': {
      text: "%REBELONLY%%LINEBREAK%Enemy ships inside your firing arc that you are touching are not considered to be touching you when either you or they activate during the Combat phase."
    },
    'Kanan Jarrus': {
      text: "%REBELONLY%%LINEBREAK%Once per round, after a friendly ship at Range 1-2 executes a white maneuver, you may remove 1 stress token from that ship."
    },
    'Reinforced Deflectors': {
      text: "%LARGESHIPONLY%%LINEBREAK%After you suffer 3 or more damage from an attack, recover one shield (up to your shield value)."
    },
    'Dorsal Turret': {
      text: "<strong>Attack:</strong> Attack 1 ship (even a ship outside your firing arc).%LINEBREAK%If the target of this attack is at Range 1, roll 1 additional attack die."
    },
    'Targeting Astromech': {
      text: 'After you execute a red maneuver, you may acquire a target lock.'
    },
    'Hera Syndulla': {
      text: "%REBELONLY%%LINEBREAK%You may reveal and execute red maneuvers even while you are stressed."
    },
    'Ezra Bridger': {
      text: "%REBELONLY%%LINEBREAK%When attacking, if you are stressed, you may change 1 of your %FOCUS% results to a %CRIT% result."
    },
    'Sabine Wren': {
      text: "%REBELONLY%%LINEBREAK%Your upgrade bar gains the %BOMB% upgrade icon.  Once per round, before a friendly bomb token is removed, choose 1 enemy ship at Range 1 of that token. That ship suffers 1 damage."
    },
    '"Chopper"': {
      text: "%REBELONLY%%LINEBREAK%You may perform actions even while you are stressed.%LINEBREAK%After you perform an action while you are stressed, suffer 1 damage."
    },
    'Construction Droid': {
      text: '%HUGESHIPONLY% %LIMITED%%LINEBREAK%When you perform a recover action, you may spend 1 energy to discard 1 facedown Damage card.'
    },
    'Cluster Bombs': {
      text: 'After defending, you may discard this card.  If you do, each other ship at Range 1 of the defending section rolls 2 attack dice, suffering all damage (%HIT%) and critical damage (%CRIT%) rolled.'
    },
    "Adaptability (+1)": {
      text: "<span class=\"card-restriction\">Dual card.</span>%LINEBREAK%Increase your pilot skill value by 1."
    },
    "Adaptability (-1)": {
      text: "<span class=\"card-restriction\">Dual card.</span>%LINEBREAK%Decrease your pilot skill value by 1."
    },
    "Electronic Baffle": {
      text: "When you receive a stress token or an ion token, you may suffer 1 damage to discard that token."
    },
    "4-LOM": {
      text: "%SCUMONLY%%LINEBREAK%When attacking, during the \"Modify Attack Dice\" step, you may receive 1 ion token to choose 1 of the defender's focus or evade tokens.  That token cannot be spent during this attack."
    },
    "Zuckuss": {
      text: "%SCUMONLY%%LINEBREAK%When attacking, you may receive any number of stress tokens to choose an equal number of defense dice.  The defender must reroll those dice."
    },
    'Rage': {
      text: "<strong>Action:</strong> Assign 1 focus token to your ship and receive 2 stress tokens.  Until the end of the round, when attacking, you may reroll up to 3 attack dice."
    },
    "Attanni Mindlink": {
      text: "%SCUMONLY%%LINEBREAK%Each time you are assigned a focus or stress token, each other friendly ship with Attanni Mindlink must also be assigned the same type of token if it does not already have one."
    },
    "Boba Fett": {
      text: "%SCUMONLY%%LINEBREAK%After performing an attack, if the defender was dealt a faceup Damage card, you may discard this card to choose and discard 1 of the defender's Upgrade cards."
    },
    "Dengar": {
      text: "%SCUMONLY%%LINEBREAK%When attacking, you may reroll 1 attack die.  If the defender is a unique pilot, you may instead reroll up to 2 attack dice."
    },
    '"Gonk"': {
      text: "%SCUMONLY%%LINEBREAK%<strong>Action:</strong> Place 1 shield token on this card.%LINEBREAK%<strong>Action:</strong> Remove 1 shield token from this card to recover 1 shield (up to your shield value)."
    },
    "R5-P8": {
      text: "Once per round, after defending, you may roll 1 attack die.  On a %HIT% result, the attacker suffers 1 damage.  On a %CRIT% result, you and the attacker each suffer 1 damage."
    },
    'Thermal Detonators': {
      text: "When you reveal your maneuver dial, you may discard this card to <strong>drop</strong> 1 thermal detonator token.%LINEBREAK%This token <strong>detonates</strong> at the end of the Activation phase.%LINEBREAK%<strong>Thermal Detonator Token:</strong> When this bomb token detonates, each ship at Range 1 of the token suffers 1 damage and receives 1 stress token.  Then discard this token."
    },
    "Overclocked R4": {
      text: "During the Combat phase, when you spend a focus token, you may receive 1 stress token to assign 1 focus token to your ship."
    }
  };
  modification_translations = {
    "Shield Upgrade": {
      name: "Boucliers améliorés",
      text: "Augmentez votre valeur de boucliers de 1."
    },
    "Advanced Cloaking Device": {
      name: "Système d'occultation avancé",
      text: "<span class=\"card-restriction\">TIE Fantôme uniquement.</span>%LINEBREAK%Après avoir effectué une attaque, vous pouvez effectuer une action d'occultation gratuite.",
      ship: "TIE Fantôme"
    },
    "Stealth Device": {
      name: "Système d'occultation",
      text: "Augmentez votre valeur d'agilité de 1. Si une attaque vous touche, défaussez cette carte."
    },
    "Engine Upgrade": {
      name: "Moteurs améliorés",
      text: "Votre barre d'actions gagne l'icône d'action %BOOST%."
    },
    "Anti-Pursuit Lasers": {
      name: "Lasers antipoursuite",
      text: "%FR_LARGESHIPONLY%Quand un vaisseau ennemi exécute une manœuvre qui l'oblige à chevaucher votre appareil, lancez 1 dé d'attaque. Sur un résultat %HIT% ou %CRIT%, le vaisseau ennemi subit 1 dégât."
    },
    "Targeting Computer": {
      name: "Ordinateur de visée",
      text: "Votre barre d'action gagne l'icône d'action %TARGETLOCK%."
    },
    "Hull Upgrade": {
      name: "Coque améliorée",
      text: "Augmentez votre valeur de coque de 1."
    },
    "Munitions Failsafe": {
      name: "Munitions à sûreté intégrée",
      text: "Quand vous attaquez avec une arme secondaire qui vous demande de la défausser pour effectuer cette attaque, défaussez-la seulement si l'attaque touche."
    },
    "Stygium Particle Accelerator": {
      name: "Accélérateur de particules de Stygium",
      text: "Quand vous vous désoccultez ou effectuez une action d'occultation, vous pouvez effectuer une action d'évasion gratuite."
    },
    "Combat Retrofit": {
      name: "Préparé pour le combat",
      text: "<span class=\"card-restriction\">GR-75 uniquement.</span>%LINEBREAK%Augmentez votre valeur de coque de 2 et votre valeur de boucliers de 1.",
      ship: "Transport moyen GR-75"
    },
    "B-Wing/E2": {
      text: "<span class=\"card-restriction\">B-Wing uniquement.</span>%LINEBREAK%Votre bandeau d'améliorations gagne l'icône d'amélioration %CREW%."
    },
    "Countermeasures": {
      name: "Contre-mesures",
      text: "%FR_LARGESHIPONLY%%LINEBREAK%Au début de la phase de combat, vous pouvez défausser cette carte pour augmenter votre valeur d'agilité de 1 jusqu'à la fin du tour. Ensuite, vous pouvez retirer 1 acquisition de cible ennemie de votre vaisseau."
    },
    "Experimental Interface": {
      name: "Interface expérimentale",
      text: "Une fois par tour, après avoir effectué une action, vous pouvez effectuer 1 action gratuite d'une de vos cartes amélioration équipée ayant l'entrée \"<strong>Action :</strong>\". Ensuite, recevez 1 marqueur de stress."
    },
    "Tactical Jammer": {
      name: "Brouilleur tactique",
      text: "%FR_LARGESHIPONLY%%LINEBREAK%Votre vaisseau peut gêner les attaques ennemies."
    },
    "Autothrusters": {
      name: "Autopropulseurs",
      text: "Quand vous défendez, si vous êtes au-delà de la portée 2 ou en dehors de l'arc de tir de l'attaquant, vous pouvez changer 1 de vos résultats vierges en un résultat %EVADE%. Vous ne pouvez vous équiper de cette carte que si vous avez l'icône d'action %BOOST%."
    },
    "Twin Ion Engine Mk. II": {
      text: "You may treat all bank maneuvers (%BANKLEFT% and %BANKRIGHT%) as green maneuvers."
    },
    "Maneuvering Fins": {
      text: "When you reveal a turn maneuver (%TURNLEFT% or %TURNRIGHT%), you may rotate your dial to the corresponding bank maneuver (%BANKLEFT% or %BANKRIGHT%) of the same speed."
    },
    "Ion Projector": {
      text: "%LARGESHIPONLY%%LINEBREAK%After an enemy ship executes a maneuver that causes it to overlap your ship, roll 1 attack die.  On a %HIT% or %CRIT% result, the enemy ship receives 1 ion token."
    },
    'Integrated Astromech': {
      text: '<span class="card-restriction">X-wing only.</span>%LINEBREAK%When you are dealt a Damage card, you may discard 1 of your %ASTROMECH% Upgrade cards to discard that Damage card.'
    },
    'Optimized Generators': {
      text: '%HUGESHIPONLY%%LINEBREAK%Once per round, when you assign energy to an equipped Upgrade card, gain 2 energy.'
    },
    'Automated Protocols': {
      text: '%HUGESHIPONLY%%LINEBREAK%Once per round, after you perform an action that is not a recover or reinforce action, you may spend 1 energy to perform a free recover or reinforce action.'
    },
    'Ordnance Tubes': {
      text: '%HUGESHIPONLY%%LINEBREAK%You may treat each of your %HARDPOINT% upgrade icons as a %TORPEDO% or %MISSILE% icon.%LINEBREAK%When you are instructed to discard a %TORPEDO% or %MISSILE% Upgrade card, do not discard it.'
    },
    'Long-Range Scanners': {
      text: 'You can acquire target locks on ships at Range 3 and beyond.  You cannot acquire target locks on ships at Range 1-2.  You can equip this card only if you have %TORPEDO% and %MISSILE% in your upgrade bar.'
    },
    "Guidance Chips": {
      text: "Once per round, when attacking with a %TORPEDO% or %MISSILE% secondary weapon, you may change 1 die result to a %HIT% result (or a %CRIT% result if your primary weapon value is \"3\" or higher)."
    }
  };
  title_translations = {
    "Slave I": {
      text: "<span class=\"card-restriction\">Firespray-31 uniquement.</span>%LINEBREAK%Votre bandeau d'amélioration gagne l'icône %TORPEDO%."
    },
    "Millennium Falcon": {
      name: "Faucon Millenium",
      text: "<span class=\"card-restriction\">YT-1300 uniquement.</span>%LINEBREAK%Votre barre d'actions gagne l'icône d'action %EVADE%."
    },
    "Moldy Crow": {
      text: "<span class=\"card-restriction\">HWK-290 uniquement.</span>%LINEBREAK%Lors de la phase de dénouement, ne retirez pas les marqueurs concentrations inutilisés de votre vaisseau."
    },
    "ST-321": {
      ship: "Navette de classe Lambda",
      text: "<span class=\"card-restriction\">Navette de classe <em>Lambda</em> uniquement.</span>%LINEBREAK%Quand vous verrouillez une cible, vous pouvez verrouiller n'importe quel vaisseau ennemi situé dans la zone de jeu."
    },
    "Royal Guard TIE": {
      ship: "Intercepteur TIE",
      name: "TIE de la Garde royale",
      text: "<span class=\"card-restriction\">TIE Interceptor uniquement.</span>%LINEBREAK%Vous pouvez vous équiper de 2 améliorations Modification différentes (au lieu de 1).%LINEBREAK%Cette carte ne peut pas équiper un vaisseau dont la valeur de pilotage est de \"4\" ou moins."
    },
    "Dodonna's Pride": {
      ship: "Corvette CR90 (proue)",
      text: "<span class=\"card-restriction\">CR90 fore section uniquement.</span>%LINEBREAK%Quand vous effectuez une action de coordination, vous pouvez choisir 2 vaisseaux alliés (au lieu de 1). Chacun de ces vaisseaux peut effectuer 1 action gratuite."
    },
    "A-Wing Test Pilot": {
      name: "Pilote d'essai sur A-Wing",
      text: "<span class=\"card-restriction\">A-Wing uniquement.</span>%LINEBREAK%Votre bandeau d'amélioration gagne 1 icône d'amélioration %ELITE%.%LINEBREAK%Vous ne pouvez pas équiper 2 cartes amélioration %ELITE% identiques. Vous ne pouvez pas vous équiper de cette carte si votre valeur de pilotage est des \"1\" ou moins."
    },
    "Tantive IV": {
      ship: "Corvette CR90 (proue)",
      text: "<span class=\"card-restriction\">CR90 (proue) uniquement.</span>%LINEBREAK%Le bandeau d'amélioration de votre proue gagne 1 icône %CREW% et 1 icône %TEAM% d'améliorations supplémentaires."
    },
    "Bright Hope": {
      ship: "Transport moyen GR-75",
      text: "<span class=\"card-restriction\">GR-75 uniquement.</span>%LINEBREAK%Un marqueur de renforcement assigné à votre proue ajoute 2 résultats %EVADE% (au lieu de 1)."
    },
    "Quantum Storm": {
      ship: "Transport moyen GR-75",
      text: "<span class=\"card-restriction\">GR-75 uniquement.</span>%LINEBREAK%Au début de la phase de dénouement, si vous avez 1 marqueur d'énergie ou moins, vous gagnez 1 marqueur d'énergie."
    },
    "Dutyfree": {
      ship: "Transport moyen GR-75",
      text: "<span class=\"card-restriction\">GR-75 uniquement.</span>%LINEBREAK%Quand vous effectuez une action de brouillage, vous pouvez choisir un vaisseau ennemi situé à portée 1-3 (au lieu de portée 1-2)."
    },
    "Jaina's Light": {
      ship: "Corvette CR90 (proue)",
      text: "<span class=\"card-restriction\">CR90 (proue) uniquement.</span>%LINEBREAK%Quand vous défendez, une fois par attaque, si vous recevez une carte de dégâts face visible, vous pouvez la défausser et piocher une autre carte de dégâts face visible."
    },
    "Outrider": {
      text: "<span class=\"card-restriction\">YT-2400 UNIQUEMENT. TITRE</span>%LINEBREAK%Tant que vous êtes équipé d'une carte d'amélioration %CANNON%, vous <strong>ne pouvez pas</strong> effectuer d'attaques d'arme principale et vous pouvez effectuer des attaques d'arme secondaire %CANNON% contre des vaisseaux situés en dehors de votre arc de tir."
    },
    "Dauntless": {
      ship: "Décimateur VT-49",
      text: "<span class=\"card-restriction\">Décimateur VT-49 uniquement.</span>%LINEBREAK%Après avoir exécuté une manœuvre qui vous fait chevaucher un autre vaisseau, vous pouvez effectuer 1 action gratuite. Ensuite, recevez 1 marqueur de stress."
    },
    "Virago": {
      text: "<span class=\"card-restriction\">StarViper uniquement.</span>%LINEBREAK%Votre bandeau d'amélioration gagne les icônes d'amélioration %SYSTEM% et %ILLICIT%.%LINEBREAK%Vous ne pouvez pas vous équiper de cette carte si votre valeur de pilotage est de \"3\" ou moins."
    },
    '"Heavy Scyk" Interceptor (Cannon)': {
      name: 'Intercepteur "Scyk Lourd" (Cannon)',
      ship: "Intercepteur M3-A",
      text: "<span class=\"card-restriction\">Intercepteur M3-A uniquement. Titre.</span>%LINEBREAK%Votre bandeau d'amélioration gagne l'icône d'amélioration %CANNON%, %TORPEDO%, ou %MISSILE%."
    },
    '"Heavy Scyk" Interceptor (Torpedo)': {
      name: 'Intercepteur "Scyk Lourd" (Torpille)',
      ship: "Intercepteur M3-A",
      text: "<span class=\"card-restriction\">Intercepteur M3-A uniquement. Titre.</span>%LINEBREAK%Votre bandeau d'amélioration gagne l'icône d'amélioration %CANNON%, %TORPEDO%, ou %MISSILE%."
    },
    '"Heavy Scyk" Interceptor (Missile)': {
      name: 'Intercepteur "Scyk Lourd" (Missile)',
      ship: "Intercepteur M3-A",
      text: "<span class=\"card-restriction\">Intercepteur M3-A uniquement. Titre.</span>%LINEBREAK%Votre bandeau d'amélioration gagne l'icône d'amélioration %CANNON%, %TORPEDO%, ou %MISSILE%."
    },
    "IG-2000": {
      text: "<span class=\"card-restriction\">Aggressor uniquement.</span>%LINEBREAK%Vous avez la capacité de pilote de chaque autre vaisseau allié avec la carte d'amélioration <em>IG-2000</em> (en plus de votre capacité de pilote)."
    },
    "BTL-A4 Y-Wing": {
      name: "Y-wing BTL-A4",
      text: "<span class=\"card-restriction\">Y-Wing uniquement. Titre.</span>%LINEBREAK%Vous ne pouvez pas attaquer les vaisseaux en dehors de votre arc de tir. Après avoir effectué une attaque d'arme principale, vous pouvez immédiatement effectuer une attaque avec une arme secondaire %TURRET%."
    },
    "Andrasta": {
      text: "Votre bandeau d'amélioration gagne deux icônes d'amélioration %BOMB% supplémentaires."
    },
    "TIE/x1": {
      text: "<span class=\"card-restriction\">TIE Advanced uniquement. Titre.</span>%LINEBREAK%Votre bandeau d'améliorations gagne l'icône d'amélioration %SYSTEM%.%LINEBREAK%Si vous êtes équipé d'une amélioration %SYSTEM%, ses points d'escadron sont réduits de 4 (jusqu'à un minimum de 0)."
    },
    "Ghost": {
      text: "<span class=\"card-restriction\">VCX-100 only.</span>%LINEBREAK%Equip the <em>Phantom</em> title card to a friendly Attack Shuttle and dock it to this ship.%LINEBREAK%After you execute a maneuver, you may deploy it from your rear guides."
    },
    "Phantom": {
      text: "While you are docked, the <em>Ghost</em> can perform primary weapon attacks from its special firing arc, and, at the end of the Combat phase, it may perform an additional attack with an equipped %TURRET%. If it performs this attack, it cannot attack again this round."
    },
    "TIE/v1": {
      text: "<span class=\"card-restriction\">TIE Advanced Prototype only.</span>%LINEBREAK%After you acquire a target lock, you may perform a free evade action."
    },
    "Mist Hunter": {
      text: "<span class=\"card-restriction\">G-1A starfighter only.</span>%LINEBREAK%Your upgrade bar gains the %BARRELROLL% Upgrade icon.%LINEBREAK%You <strong>must</strong> equip 1 \"Tractor Beam\" Upgrade card (paying its squad point cost as normal)."
    },
    "Punishing One": {
      text: "<span class=\"card-restriction\">JumpMaster 5000 only.</span>%LINEBREAK%Increase your primary weapon value by 1."
    },
    "Assailer": {
      text: "<span class=\"card-restriction\"><em>Raider</em>-class corvette aft section only.</span>%LINEBREAK%When defending, if the targeted section has a reinforce token, you may change 1 %FOCUS% result to a %EVADE% result."
    },
    "Instigator": {
      text: "<span class=\"card-restriction\"><em>Raider</em>-class corvette aft section only.</span>%LINEBREAK%After you perform a recover action, recover 1 additional shield."
    },
    "Impetuous": {
      text: "<span class=\"card-restriction\"><em>Raider</em>-class corvette aft section only.</span>%LINEBREAK%After you perform an attack that destroys an enemy ship, you may acquire a target lock."
    },
    'TIE/x7': {
      text: '<span class="card-restriction">TIE Defender only.</span>%LINEBREAK%Your upgrade bar loses the %CANNON% and %MISSILE% upgrade icons.%LINEBREAK%After executing a 3-, 4-, or 5-speed maneuver, you may assign 1 evade token to your ship.'
    },
    'TIE/D': {
      text: '<span class="card-restriction">TIE Defender only.</span>%LINEBREAK%Once per round, after you perform an attack with a %CANNON% secondary weapon that costs 3 or fewer squad points, you may perform a primary weapon attack.'
    },
    'TIE Shuttle': {
      text: '<span class="card-restriction">TIE Bomber only.</span>%LINEBREAK%Your upgrade bar loses all %TORPEDO%, %MISSILE%, and %BOMB% upgrade icons and gains 2 %CREW% upgrade icons.  You cannot equip a %CREW% Upgrade card that costs more than 4 squad points.'
    },
    'Requiem': {
      text: '%GOZANTIONLY%%LINEBREAK%When you deploy a ship, treat its pilot skill value as "8" until the end of the round.'
    },
    'Vector': {
      text: '%GOZANTIONLY%%LINEBREAK%After you execute a maneuver, you may deploy up to 4 attached ships (instead of 2).'
    },
    'Suppressor': {
      text: '%GOZANTIONLY%%LINEBREAK%Once per round, after you acquire a target lock, you may remove 1 focus, evade, or blue target lock token from that ship.'
    }
  };
  return exportObj.setupCardData(basic_cards, pilot_translations, upgrade_translations, modification_translations, title_translations);
};

exportObj = typeof exports !== "undefined" && exports !== null ? exports : this;

if (exportObj.codeToLanguage == null) {
  exportObj.codeToLanguage = {};
}

exportObj.codeToLanguage.pl = 'Polski';

if (exportObj.translations == null) {
  exportObj.translations = {};
}

exportObj.translations['Polski'] = {
  action: {
    "Barrel Roll": "Beczka",
    "Boost": "Dopalacz",
    "Evade": "Unik",
    "Focus": "Skupienie",
    "Target Lock": "Namierzenie celu",
    "Recover": "Naprawa",
    "Reinforce": "Umocnienie",
    "Jam": "Zakłócanie",
    "Coordinate": "Koordynacja",
    "Cloak": "Maskowanie"
  },
  slot: {
    "Astromech": "Astromech",
    "Bomb": "Bomba",
    "Cannon": "Działo",
    "Crew": "Załoga",
    "Elite": "Talent elitarny",
    "Missile": "Rakiety",
    "System": "System",
    "Torpedo": "Torpedy",
    "Turret": "Wieżyczka",
    "Cargo": "Ładunek",
    "Hardpoint": "Punkt konstrukcyjny",
    "Team": "Drużyna",
    "Illicit": "Kontrabanda",
    "Salvaged Astromech": "Złomowane astromechy"
  },
  sources: {
    "Core": "Zestaw Podstawowy",
    "A-Wing Expansion Pack": "Zestaw dodatkowy A-Wing",
    "B-Wing Expansion Pack": "Zestaw dodatkowy B-Wing",
    "X-Wing Expansion Pack": "Zestaw dodatkowy X-Wing",
    "Y-Wing Expansion Pack": "Zestaw dodatkowy Y-Wing",
    "Millennium Falcon Expansion Pack": "Zestaw dodatkowy Sokół Millennium",
    "HWK-290 Expansion Pack": "Zestaw dodatkowy HWK-290",
    "TIE Fighter Expansion Pack": "Zestaw dodatkowy Myśliwiec TIE",
    "TIE Interceptor Expansion Pack": "Zestaw dodatkowy TIE Interceptor",
    "TIE Bomber Expansion Pack": "Zestaw dodatkowy Bombowiec TIE",
    "TIE Advanced Expansion Pack": "Zestaw dodatkowy TIE Advanced",
    "Lambda-Class Shuttle Expansion Pack": "Zestaw dodatkowy Prom typu Lambda",
    "Slave I Expansion Pack": "Zestaw dodatkowy Slave I",
    "Imperial Aces Expansion Pack": "Zestaw dodatkowy Asy Imperium",
    "Rebel Transport Expansion Pack": "Zestaw dodatkowy Rebeliancki transportowiec",
    "Z-95 Headhunter Expansion Pack": "Zestaw dodatkowy Z-95 Łowca Głów",
    "TIE Defender Expansion Pack": "Zestaw dodatkowy TIE Defender",
    "E-Wing Expansion Pack": "Zestaw dodatkowy E-Wing",
    "TIE Phantom Expansion Pack": "Zestaw dodatkowy TIE Phantom",
    "Tantive IV Expansion Pack": "Zestaw dodatkowy Tantive IV",
    "Rebel Aces Expansion Pack": "Zestaw dodatkowy Asy Rebelii",
    "YT-2400 Freighter Expansion Pack": "Zestaw dodatkowy YT-2400",
    "VT-49 Decimator Expansion Pack": "Zestaw dodatkowy Decimator VT-49",
    "StarViper Expansion Pack": "Zestaw dodatkowy StarViper",
    "M3-A Interceptor Expansion Pack": "Zestaw dodatkowy M3-A Interceptor",
    "IG-2000 Expansion Pack": "Zestaw dodatkowy IG-2000",
    "Most Wanted Expansion Pack": "Zestaw dodatkowy Poszukiwani",
    "Imperial Raider Expansion Pack": "Zestaw dodatkowy Imperialny Patrolowiec",
    "The Force Awakens Core Set": "The Force Awakens Core Set"
  },
  ui: {
    shipSelectorPlaceholder: "Wybór statków",
    pilotSelectorPlaceholder: "Wybór pilotów",
    upgradePlaceholder: function(translator, language, slot) {
      return "" + (translator(language, 'slot', slot));
    },
    modificationPlaceholder: "Modyfikacje",
    titlePlaceholder: "Tytuł",
    upgradeHeader: function(translator, language, slot) {
      return "Amélioration " + (translator(language, 'slot', slot));
    },
    unreleased: "niewydane",
    epic: "epickie"
  },
  byCSSSelector: {
    '.xwing-card-browser .translate.sort-cards-by': 'Sortuj karty po',
    '.xwing-card-browser option[value="name"]': 'nazwie',
    '.xwing-card-browser option[value="source"]': 'źródle',
    '.xwing-card-browser option[value="type-by-points"]': 'typie (po punktach)',
    '.xwing-card-browser option[value="type-by-name"]': 'typie (po nazwie)',
    '.xwing-card-browser .translate.select-a-card': 'Wybierz kartę z listy po prawej',
    '.xwing-card-browser .info-range td': 'Zasięg’',
    '.info-well .info-ship td.info-header': 'Statek',
    '.info-well .info-skill td.info-header': 'Umiejętność pilota',
    '.info-well .info-actions td.info-header': 'Akcje',
    '.info-well .info-upgrades td.info-header': 'Ulepszenia',
    '.info-well .info-range td.info-header': 'Zasięg',
    '.clear-squad': 'Wyczyść eskadrę',
    '.save-list': 'Zapisz',
    '.save-list-as': 'Zapisz jako ...',
    '.delete-list': 'Usuń',
    '.backend-list-my-squads': 'Lista eskadr',
    '.view-as-text': '<span class="hidden-phone"><i class="icon-print"></i>&nbsp;Drukuj \ Wyświetl jako </span>Tekst',
    '.randomize': 'randomizuj',
    '.randomize-options': 'Opcje ...',
    '.notes-container > span': 'Squad Notes',
    '.bbcode-list': 'Skopiuj BBCode poniżej i wklej go do swojego posta.<textarea></textarea><button class="btn btn-copy">Skopiuj</button>',
    '.html-list': '<textarea></textarea><button class="btn btn-copy">Skopiuj</button>',
    '.vertical-space-checkbox': "Dodaj miejsce na karty ulepszeń \ uszkodzeń podczas drukowania <input type=\"checkbox\" class=\"toggle-vertical-space\" />",
    '.color-print-checkbox': "Wydrukuj w kolorze <input type=\"checkbox\" class=\"toggle-color-print\" />",
    '.print-list': '<i class="icon-print"></i>&nbsp;Drukuj',
    '.do-randomize': 'Generuj',
    '#empireTab': 'Imperium Galaktyczne',
    '#rebelTab': 'Sojusz Rebeliancki',
    '#scumTab': 'Szumowiny i Nikczemnicy',
    '#browserTab': 'Przeglądarka kart',
    '#aboutTab': 'O stronie'
  },
  singular: {
    'pilots': 'Pilot',
    'modifications': 'Modyfikacja',
    'titles': 'Tytuł'
  },
  types: {
    'Pilot': 'Pilot',
    'Modification': 'Modyfikacja',
    'Title': 'Tytuł'
  }
};

if (exportObj.cardLoaders == null) {
  exportObj.cardLoaders = {};
}

exportObj.cardLoaders['Polski'] = function() {
  var basic_cards, modification_translations, pilot_translations, title_translations, upgrade_translations;
  exportObj.cardLanguage = 'Polski';
  basic_cards = exportObj.basicCardData();
  exportObj.canonicalizeShipNames(basic_cards);
  exportObj.ships = basic_cards.ships;
  exportObj.renameShip('TIE Fighter', 'Myśliwiec TIE');
  exportObj.renameShip('TIE Bomber', 'Bombowiec TIE');
  exportObj.renameShip('Lambda-Class Shuttle', 'Prom typu Lambda');
  exportObj.renameShip('VT-49 Decimator', 'Decimator VT-49');
  exportObj.renameShip('Z-95 Headhunter', 'Z-95 Łowca głów');
  exportObj.renameShip('CR90 Corvette (Aft)', 'Korweta CR90 (rufa)');
  exportObj.renameShip('CR90 Corvette (Fore)', 'Corvette CR90 (dziób)');
  exportObj.renameShip('GR-75 Medium Transport', 'Średni transportowiec GR-75');
  pilot_translations = {
    "Academy Pilot": {
      ship: "Myśliwiec TIE",
      name: "Pilot z Akademii"
    },
    "Obsidian Squadron Pilot": {
      ship: "Myśliwiec TIE",
      name: "Pilot Eskadry Obsydianowych"
    },
    "Black Squadron Pilot": {
      ship: "Myśliwiec TIE",
      name: "Pilot Eskadry Czarnych"
    },
    '"Winged Gundark"': {
      name: "Skrzydlaty Gundark",
      ship: "Myśliwiec TIE",
      text: "Kiedy atakujesz w Zasięgu 1, możesz zmienić 1 ze swoich wyników %HIT% na wynik %CRIT%."
    },
    '"Night Beast"': {
      name: "Nocny Potwór",
      ship: "Myśliwiec TIE",
      text: "Po wykonaniu zielonego manewru możesz wykonać darmową akcję skupienia."
    },
    '"Backstabber"': {
      ship: "Myśliwiec TIE",
      text: "Kiedy atakujesz będąc poza polem rażenia broniącego się statku, rzucasz 1 dodatkową kością ataku."
    },
    '"Dark Curse"': {
      name: "Mroczna Klątwa",
      ship: "Myśliwiec TIE",
      text: "Kiedy się bronisz statki które cię atakują nie mogą wydawać żetonów skupienia ani przerzucać kości ataku."
    },
    '"Mauler Mithel"': {
      ship: "Myśliwiec TIE",
      text: "Kiedy atakujesz w Zasięgu 1, rzucasz 1 dodatkową kością ataku."
    },
    '"Howlrunner"': {
      ship: "Myśliwiec TIE",
      text: "Kiedy inny przyjazny statek w zasięgu 1 atakuje przy pomocy swojej podstawowej broni, może przerzucić 1 kość ataku."
    },
    "Alpha Squadron Pilot": {
      name: "Pilot Eskadry Alfa"
    },
    "Avenger Squadron Pilot": {
      name: "Pilot Eskadry Mścicieli"
    },
    "Saber Squadron Pilot": {
      name: "Pilot Eskadry Szabel"
    },
    "Royal Guard Pilot": {
      name: "Pilot imperialny gwardzista"
    },
    "\"Fel's Wrath\"": {
      name: "\"Gniew Fel'a\"",
      text: "Zostajesz zniszczony dopiero pod koniec fazy walki, w której liczba kart uszkodzeń przypisanych do ciebie będzie równa, lub wyższa od twojej wartości kadłuba."
    },
    "Lieutenant Lorrir": {
      name: "Porucznik Lorrir",
      text: "Kiedy wykonujesz akcję \"beczka\", możesz otrzymać 1 żeton stresu, aby zamiast wzornika manewru (%STRAIGHT% 1) użyć (%BANKLEFT% 1) lub (%BANKRIGHT% 1)."
    },
    "Kir Kanos": {
      text: "Kiedy atakujesz w Zasięgu 2-3, możesz wydać 1 żeton uników, aby dodać 1 %HIT% do swojego wyniku."
    },
    "Tetran Cowall": {
      text: "Kiedy ujawnisz manewr %UTURN% możesz traktować go tak, jakby jego prędkość wynosiła \"1\", \"3\" lub \"5\"."
    },
    "Turr Phennir": {
      text: "Po wykonaniu ataku możesz wykonać darmową akcję \"dopalacz\" lub \"beczka\"."
    },
    "Carnor Jax": {
      text: "Wrogie statki w Zasięgu 1 nie mogą wykonywać akcji \"skupienie\" oraz \"unik\", ani wydawać żetonów skupienia i uników."
    },
    "Soontir Fel": {
      text: "Kiedy otrzymujesz żeton stresu, możesz przypisać do swojego statku 1 żeton skupienia."
    },
    "Sigma Squadron Pilot": {
      name: "Pilot Eskadry Sigma"
    },
    "Shadow Squadron Pilot": {
      name: "Pilot Eskadry Cieni"
    },
    '"Echo"': {
      text: "Kiedy się demaskujesz musisz użyć wzornika manewru (%BANKLEFT% 2) lub (%BANKRIGHT% 2) zamiast wzornika (%STRAIGHT% 2)."
    },
    '"Whisper"': {
      name: "Szept",
      text: "Po tym jak wykonasz atak, który trafi cel, możesz przypisać do swojego statku 1 żeton skupienia."
    },
    "Onyx Squadron Pilot": {
      name: "Pilot Eskadry Onyx"
    },
    "Delta Squadron Pilot": {
      name: "Pilot Eskadry Delta"
    },
    "Colonel Vessery": {
      name: "Pułkownik Vessery",
      text: "Kiedy atakujesz, zaraz po swoim rzucie kośćmi ataku możesz namierzyć obrońcę, jeśli ma na sobie czerwony żeton namierzonego celu."
    },
    "Rexler Brath": {
      text: "Po tym jak wykonasz atak, który zada obrońcy co najmniej jedną kartę uszkodzenia, możesz wydać żeton skupienia aby odkryć te karty."
    },
    "Scimitar Squadron Pilot": {
      ship: "Bombowiec TIE",
      name: "Pilot Eskadry Sejmitarów"
    },
    "Gamma Squadron Pilot": {
      ship: "Bombowiec TIE",
      name: "Pilot Eskadry Gamma"
    },
    "Captain Jonus": {
      ship: "Bombowiec TIE",
      name: "Kapitan Jonus",
      text: "Kiedy inny przyjazny statek w Zasięgu 1 atakuje przy pomocy dodatkowej broni, może przerzucić maksymalnie 2 kości ataku."
    },
    "Major Rhymer": {
      ship: "Bombowiec TIE",
      text: "Kiedy atakujesz przy pomocy dodatkowej broni, możesz zwiększyć lub zmniejszyć zasięg broni o 1. Musisz przy tym zachować limit zasięgu 1-3."
    },
    "Tempest Squadron Pilot": {
      name: "Pilot Eskadry Burzy"
    },
    "Storm Squadron Pilot": {
      name: "Pilot Eskadry Szturmu"
    },
    "Maarek Stele": {
      text: "Kiedy twój atak zadaje obrońcy odkrytą kartę uszkodzenia, wylosuj 3 karty uszkodzeń, wybierz 1 z nich, którą zadajesz, a pozostałe odrzuć."
    },
    "Darth Vader": {
      text: "Podczas swojego kroku \"Wykonywania akcji\" możesz wykonać 2 akcje."
    },
    "Commander Alozen": {
      name: "Komandor Alozen",
      text: "Na początku fazy walki możesz namierzyć wrogi statek znajdujący się w Zasięgu 1 od ciebie."
    },
    "Bounty Hunter": {
      name: "Łowca nagród"
    },
    "Kath Scarlet": {
      text: "Kiedy atakujesz, obrońca otrzymuje 1 żeton stresu, jeśli anuluje co najmniej jeden wynik %CRIT%."
    },
    "Boba Fett": {
      text: "Kiedy ujawniasz manewr skrętu (%BANKLEFT% lub %BANKRIGHT%) możesz przestawić swój wskaźnik manewrów na drugi manewr skrętu o tej samej prędkości."
    },
    "Krassis Trelix": {
      text: "Kiedy atakujesz przy pomocy dodatkowej broni, możesz przerzucić 1 kość ataku."
    },
    "Captain Kagi": {
      ship: "Prom typu Lambda",
      name: "Kapitan Kagi",
      text: "Kiedy wrogi statek namierza cel, musi namierzyć twój statek, jeśli to możliwe."
    },
    "Colonel Jendon": {
      name: "Pułkownik Jendon",
      ship: "Prom typu Lambda",
      text: "Na początku fazy walki możesz przypisać 1 ze swoich niebieskich żetonów namierzonego celu do przyjaznego statku w Zasięgu 1, jeśli ten nie ma niebieskiego żetonu namierzonego celu."
    },
    "Captain Yorr": {
      ship: "Prom typu Lambda",
      name: "Kapitan Yorr",
      text: "Kiedy inny przyjazny statek w Zasięgu 1-2 ma otrzymać żeton stresu, gdy ty masz 2 lub mniej żetonów stresu, możesz przypisać do siebie ten żeton stresu."
    },
    "Omicron Group Pilot": {
      ship: "Prom typu Lambda",
      name: "Pilot grupy Omicron"
    },
    "Captain Oicunn": {
      ship: "Decimator VT-49",
      name: "Kapitan Oicunn",
      text: "Po wykonaniu manewru, każdy wrogi statek z którym się stykasz, otrzymuje 1 uszkodzenie."
    },
    "Rear Admiral Chiraneau": {
      ship: "Decimator VT-49",
      name: "Kontradmirał Chiraneau",
      text: "Kiedy atakujesz w Zasięgu 1-2, możesz zmienić jeden ze swoich wyników %FOCUS% na wynik %CRIT%."
    },
    "Patrol Leader": {
      ship: "Decimator VT-49",
      name: "Dowódca Patrolu"
    },
    "Commander Kenkirk": {
      ship: "Decimator VT-49",
      name: "Commandant Kenkirk",
      text: "Jeśli nie masz żadnych osłon i masz przypisaną co najmniej 1 kartę uszkodzenia, wartość twojej zwrotności wzrasta o 1."
    },
    "Juno Eclipse": {
      text: "When you reveal your maneuver, you may increase or decrease its speed by 1 (to a minimum of 1)."
    },
    "Zertik Strom": {
      text: "Enemy ships at Range 1 cannot add their range combat bonus when attacking."
    },
    "Lieutenant Colzet": {
      text: "At the start of the End phase, you may spend a target lock you have on an enemy ship to flip 1 random facedown Damage card assigned to it faceup."
    },
    "Red Squadron Pilot": {
      name: "Pilot Eskadry Czerwonych"
    },
    "Rookie Pilot": {
      name: "Niedoświadczony pilot"
    },
    "Wedge Antilles": {
      text: "Kiedy atakujesz zredukuj wartość zwrotności obrońcy o 1 (do minimum 0)."
    },
    "Garven Dreis": {
      text: "Po tym jak wydasz żeton skupienia możesz umieścić dany żeton na dowolnym innym przyjaznym statku w Zasięgu 1-2 (zamiast go odrzucać)."
    },
    "Biggs Darklighter": {
      text: "Inne przyjazne statki w Zasięgu 1 nie mogą być wybierane na cel ataku, jeśli atakujący może na cel wybrać ciebie."
    },
    "Luke Skywalker": {
      text: "Kiedy się bronisz, możesz zmienić 1 ze swoich wyników %FOCUS% na wynik %EVADE%."
    },
    "Wes Janson": {
      text: "Po wykonaniu ataku możesz usunąć z obrońcy 1 żeton skupienia, uników, lub niebieski żeton namierzonego celu."
    },
    "Jek Porkins": {
      text: "Kiedy otrzymujesz żeton stresu możesz usunąć go i rzucić 1 kością ataku. Jeśli wypadnie %HIT%, ten statek otrzymuje 1 zakrytą kartę uszkodzenia."
    },
    '"Hobbie" Klivian': {
      text: "Kiedy zdobywasz lub wydajesz żeton namierzonego celu, możesz usunąć ze swojego statku 1 żeton stresu."
    },
    "Tarn Mison": {
      text: "Kiedy wrogi statek wybiera cię na cel ataku, możesz namierzyć ten statek."
    },
    "Gold Squadron Pilot": {
      name: "Pilot Eskadry Złotych"
    },
    "Gray Squadron Pilot": {
      name: "Pilot Eskadry Szarych"
    },
    '"Dutch" Vander': {
      text: "Po namierzeniu celu wybierz przyjazny statek w Zasięgu 1-2. Wybrany statek może natychmiast namierzyć cel."
    },
    "Horton Salm": {
      text: "Kiedy atakujesz w Zasięgu 2-3, możesz przerzucić dowolne ze swoich kości, na których wypadły puste ścianki."
    },
    "Green Squadron Pilot": {
      name: "Pilot Eskadry Zielonych"
    },
    "Prototype Pilot": {
      name: "Pilot prototypu"
    },
    "Tycho Celchu": {
      text: "Możesz wykonywać akcje nawet jeśli posiadasz żetony stresu."
    },
    "Arvel Crynyd": {
      text: "Możesz wybrać na cel swojego ataku wrogi statek, z którym się stykasz, jeżeli ten znajduje się w twoim polu rażenia."
    },
    "Outer Rim Smuggler": {
      name: "Przemytnik z Zewnętrznych Rubierzy"
    },
    "Chewbacca": {
      text: "Kiedy otrzymujesz odkrytą kartę uszkodzenia, natychmiast ją zakryj (bez rozpatrywania jej efektu)."
    },
    "Lando Calrissian": {
      text: "Po wykonaniu zielonego manewru wybierz jeden inny przyjazny statek w Zasięgu 1. Statek ten może wykonać 1 darmową akcję przedstawioną na jego pasku akcji."
    },
    "Han Solo": {
      text: "Kiedy atakujesz możesz przerzucić wszystkie swoje kości ataku. Jeśli zdecydujesz się to zrobić musisz przerzucić tyle ze swoich kości, ile możesz."
    },
    "Dagger Squadron Pilot": {
      name: "Pilot Eskadry Sztyletów"
    },
    "Blue Squadron Pilot": {
      name: "Pilot Eskadry Niebieskich"
    },
    "Ten Numb": {
      text: "Kiedy atakujesz, 1 z twoich wyników [crt-hit] nie może być anulowany przy pomocy kości obrony."
    },
    "Ibtisam": {
      text: "Kiedy atakujesz lub się bronisz mając co najmniej 1 żeton stresu, możesz przerzucić jedną ze swoich kości."
    },
    "Rebel Operative": {
      name: "Agent rebeliantów"
    },
    "Roark Garnet": {
      text: 'Na początku fazy walki wybierz 1 inny przyjazny statek w zasięgu 1-3. Do końca tej fazy traktuj wartość umiejętności tego pilota jakby wynosiła "12".'
    },
    "Kyle Katarn": {
      text: "Na początku fazy walki możesz przypisać 1 ze swoich żetonów skupienia do innego przyjaznego statku w Zasięgu 1-3."
    },
    "Jan Ors": {
      text: "Kiedy inny przyjazny statek w Zasięgu 1-3 atakuje, gdy nie masz żadnych żetonów stresu, możesz otrzymać 1 żeton stresu aby umożliwić mu rzut 1 dodatkową kością ataku."
    },
    "Bandit Squadron Pilot": {
      name: "Pilot Eskadry Bandytów",
      ship: "Z-95 Łowca głów"
    },
    "Tala Squadron Pilot": {
      name: "Pilot Eskadry Tala",
      ship: "Z-95 Łowca głów"
    },
    "Lieutenant Blount": {
      name: "Porucznik Blount",
      ship: "Z-95 Łowca głów",
      text: "Kiedy atakujesz, obrońca zostaje trafiony twoim atakiem nawet jeśli nie otrzymał żadnych uszkodzeń."
    },
    "Airen Cracken": {
      ship: "Z-95 Łowca głów",
      text: "Po wykonaniu ataku możesz wybrać inny przyjazny statek w Zasięgu 1. Dany statek może wykonać 1 darmową akcję."
    },
    "Knave Squadron Pilot": {
      name: "Pilot Eskadry Szelm"
    },
    "Blackmoon Squadron Pilot": {
      name: "Pilot Eskadry Czarnego Księżyca"
    },
    "Etahn A'baht": {
      text: "Kiedy wrogi statek w twoim polu rażenia, w Zasięgu 1-3 się broni, atakujący może zmienić 1 z jego wyników %HIT% na wynik %CRIT%."
    },
    "Corran Horn": {
      text: "Na początku fazy końcowej możesz wykonać jeden atak. Nie możesz atakować w następnej rundzie."
    },
    "Jake Farrell": {
      text: "Po tym jak wykonasz akcję skupienia lub zostanie ci przypisany żeton skupienia, możesz wykonać darmową akcję \"dopalacz\" lub \"beczka\"."
    },
    "Gemmer Sojan": {
      text: "Dopóki znajdujesz się w Zasięgu 1 od co najmniej 1 wrogiego statku, zwiększ swoją wartość zwrotności o 1."
    },
    "Keyan Farlander": {
      text: "Kiedy atakujesz możesz usunąć 1 żeton stresu aby zmienić wszystkie swoje wyniki %FOCUS% na %HIT%."
    },
    "Nera Dantels": {
      text: "Możesz wykonać atak dodatkową bronią %TORPEDO%, skierowany przeciwko wrogim statkom znajdującym się poza twoim polem rażenia."
    },
    "GR-75 Medium Transport": {
      name: "Średni transportowiec GR-75",
      ship: "Średni transportowiec GR-75"
    },
    "CR90 Corvette (Fore)": {
      ship: "Korweta CR90 (dziób)",
      name: "Korweta CR90 (dziób)",
      text: "Kiedy atakujesz przy pomocy swojej głównej broni, możesz wydać 1 żeton energii aby rzucać 1 dodatkową kością ataku."
    },
    "CR90 Corvette (Aft)": {
      ship: "Korweta CR90 (rufa)",
      name: "Korweta CR90 (rufa)"
    },
    "Dash Rendar": {
      text: "Podczas fazy aktywacji i w czasie wykonywania akcji możesz ignorować przeszkody."
    },
    '"Leebo"': {
      text: "Kiedy otrzymujesz odkrytą kartę uszkodzenia, dobierz 1 dodatkową kartę uszkodzenia. Rozpatrz jedną z nich a drugą odrzuć."
    },
    "Eaden Vrill": {
      text: "Podczas wykonywania ataku przy pomocy broni podstawowej, którego celem jest statek z żetonem stresu, rzucasz 1 dodatkową kością."
    },
    "Wild Space Fringer": {
      name: "Outsider z Dzikiej Przestrzeni"
    },
    "Prince Xizor": {
      name: "Książe Xizor",
      text: "Kiedy się bronisz, przyjazny statek w Zasięgu 1 może otrzymać 1 nieanulowany wynik %HIT% lub %CRIT% (zamiast ciebie)."
    },
    "Guri": {
      text: "Na początku fazy walki, jeśli jesteś w Zasięgu 1 od wrogiego statku, możesz przypisać do swojego statku 1 żeton skupienia."
    },
    "Black Sun Vigo": {
      name: "Vigo Czarnego Słońca"
    },
    "Black Sun Enforcer": {
      name: "Wysłannik Czarnego Słońca"
    },
    "Cartel Spacer": {
      name: "Pilot kartelu"
    },
    "Tansarii Point Veteran": {
      name: "Weteran Tansarii Point"
    },
    "Serissu": {
      text: "Kiedy inny przyjazny statek w Zasięgu 1 się broni, może przerzucić 1 kość obrony."
    },
    "Laetin A'shera": {
      text: "Po tym jak obronisz się przed atakiem, jeśli atak nie trafił, możesz przypisać do swojego statku 1 żeton uniku."
    },
    "IG-88A": {
      text: "Po tym jak wykonasz atak, który zniszczy obrońcę, możesz odzyskać 1 osłonę."
    },
    "IG-88B": {
      text: "Raz na rundę, po tym jak wykonasz atak, który nie trafi w wybrany cel, możesz wykonać atak przy pomocy dodatkowej broni %CANON%, w którą jesteś wyposażony."
    },
    "IG-88C": {
      text: "Po tym jak wykonasz akcję „dopalacz” możesz przypisać do swojego statku 1 żeton uniku."
    },
    "IG-88D": {
      text: "Możesz wykonać manewr (%SLOOPLEFT% 3) lub (%SLOOPRIGHT% 3) używając odpowiednio wzornika (%TURNLEFT% 3) lub (%TURNRIGHT% 3)."
    },
    "Boba Fett (Scum)": {
      name: "Boba Fett (Szumowiny)",
      text: "Kiedy atakujesz lub się bronisz możesz przerzucić 1 ze swoich kości za każdy wrogi statek w Zasięgu 1."
    },
    "Kath Scarlet (Scum)": {
      name: "Kath Scarlet (Szumowiny)",
      text: "Kiedy atakujesz statek znajdujący się w twoim pomocniczym polu rażenia, rzucasz 1 dodatkową kością ataku."
    },
    "Emon Azzameen": {
      text: "Kiedy zrzucasz bombę, możesz użyć wzornika [%TURNLEFT% 3], [%STRAIGHT% 3], lub [%TURNRIGHT% 3] (zamiast wzornika [%STRAIGHT% 1])."
    },
    "Mandalorian Mercenary": {
      name: "Mandaloriański najemnik"
    },
    "Kavil": {
      text: "Kiedy atakujesz statek znajdujący się poza twoim polem rażenia, rzucasz 1 dodatkową kością ataku."
    },
    "Drea Renthal": {
      text: "Po tym jak wydasz żeton namierzonego celu, możesz otrzymać 1 żeton stresu, aby namierzyć cel."
    },
    "Hired Gun": {
      name: "Najemnik"
    },
    "Syndicate Thug": {
      name: "Zbir z syndykatu"
    },
    "Dace Bonearm": {
      text: "Kiedy wrogi statek w Zasięgu 1-3 otrzyma co najmniej jeden żeton jonów, a ty nie masz żetonu stresu, możesz otrzymać 1 żeton stresu aby sprawić, żeby dany statek otrzymał 1 uszkodzenie."
    },
    "Palob Godalhi": {
      text: "Na początku fazy walki możesz usunąć 1 żeton skupienia lub uników z wrogiego statku w Zasięgu 1-2 i przypisać go do siebie."
    },
    "Torkil Mux": {
      text: "Na koniec fazy aktywacji wybierz jeden wrogi statek w Zasięgu 1-2. Do końca fazy walki wartość umiejętności pilota wybranego statku wynosi \"0\"."
    },
    "Spice Runner": {
      name: "Przemytnik przyprawy"
    },
    "Black Sun Soldier": {
      name: "Żolnierz Czarnego Słońca",
      ship: "Z-95 Łowca głów"
    },
    "Binayre Pirate": {
      name: "Pirat z Binayre",
      ship: "Z-95 Łowca głów"
    },
    "N'Dru Suhlak": {
      ship: "Z-95 Łowca głów",
      text: "Kiedy atakujesz rzucasz 1 dodatkową kością ataku, jeśli w Zasięgu 1-2 nie ma żadnych innych przyjaznych statków."
    },
    "Kaa'To Leeachos": {
      ship: "Z-95 Łowca głów",
      text: "Na początku fazy walki możesz usunąć 1 żeton skupienia lub uników z innego przyjaznego statku w Zasięgu 1-2 i przypisać go do siebie."
    },
    "Latts Razzi": {
      text: "When a friendly ship declares an attack, you may spend a target lock you have on the defender to reduce its agility by 1 for that attack."
    },
    "Graz the Hunter": {
      text: "When defending, if the attacker is inside your firing arc, roll 1 additional defense die."
    },
    "Esege Tuketu": {
      text: "When another friendly ship at Range 1-2 is attacking, it may treat your focus tokens as its own."
    },
    '"Redline"': {
      text: "You may maintain 2 target locks on the same ship.  When you acquire a target lock, you may acquire a second lock on that ship."
    },
    '"Deathrain"': {
      text: "When dropping a bomb, you may use the front guides of your ship.  After dropping a bomb, you may perform a free barrel roll action."
    },
    "Moralo Eval": {
      text: "You can perform %CANNON% secondary attacks against ships inside your auxiliary firing arc."
    },
    'Gozanti-class Cruiser': {
      text: "After you execute a maneuver, you may deploy up to 2 attached ships."
    },
    '"Scourge"': {
      text: "When attacking a defender that has 1 or more Damage cards, roll 1 additional attack die."
    },
    "The Inquisitor": {
      text: "When attacking with your primary weapon at Range 2-3, treat the range of the attack as Range 1."
    },
    "Zuckuss": {
      text: "When attacking, you may roll 1 additional attack die.  If you do, the defender rolls 1 additional defense die."
    },
    "Dengar": {
      text: "Once per round after defending, if the attacker is inside your firing arc, you may perform an attack against the that ship."
    },
    "Poe Dameron": {
      text: "When attacking or defending, if you have a focus token, you may change 1 of your %FOCUS% results to a %HIT% or %EVADE% result."
    },
    '"Blue Ace"': {
      text: "When performing a boost action, you may use the (%TURNLEFT% 1) or (%TURNRIGHT% 1) template."
    },
    '"Omega Ace"': {
      text: "When attacking, you may spend a focus token and a target lock you have on the defender to change all of your results to %CRIT% results."
    },
    '"Epsilon Leader"': {
      text: "At the start of the Combat phase, remove 1 stress token from each friendly ship at Range 1."
    },
    '"Zeta Ace"': {
      text: "When performing a barrel roll you may use the (%STRAIGHT% 2) template instead of the (%STRAIGHT% 1) template."
    },
    '"Red Ace"': {
      text: 'The first time you remove a shield token from your ship each round, assign 1 evade token to your ship.'
    },
    '"Omega Leader"': {
      text: 'Enemy ships that you have locked cannot modify any dice when attacking you or defending against your attacks.'
    },
    'Hera Syndulla': {
      text: 'When you reveal a green or red maneuver, you may rotate your dial to another maneuver of the same difficulty.'
    },
    '"Youngster"': {
      text: "Friendly TIE fighters at Range 1-3 may perform the action on your equipped %ELITE% Upgrade card."
    },
    '"Wampa"': {
      text: "When attacking, you may cancel all die results.  If you cancel a %CRIT% result, deal 1 facedown Damage card to the defender."
    },
    '"Chaser"': {
      text: "When another friendly ship at Range 1 spends a focus token, assign a focus token to your ship."
    },
    'Ezra Bridger': {
      text: "When defending, if you are stressed, you may change up to 2 of your %FOCUS% results to %EVADE% results."
    },
    '"Zeta Leader"': {
      text: 'When attacking, if you are not stressed, you may receive 1 stress token to roll 1 additional die.'
    },
    '"Epsilon Ace"': {
      text: 'While you do not have any Damage cards, treat your pilot skill value as "12."'
    },
    "Kanan Jarrus": {
      text: "When an enemy ship at Range 1-2 is attacking, you may spend a focus token.  If you do, the attacker rolls 1 fewer attack die."
    },
    '"Chopper"': {
      text: "At the start of the Combat phase, each enemy ship you are touching receives 1 stress token."
    },
    'Hera Syndulla (Attack Shuttle)': {
      text: "When you reveal a green or red maneuver, you may rotate your dial to another maneuver of the same difficulty."
    },
    'Sabine Wren': {
      text: "Immediately before you reveal your maneuver, you may perform a free boost or barrel roll action."
    },
    '"Zeb" Orrelios': {
      text: 'When defending, you may cancel %CRIT% results before %HIT% results.'
    },
    'Tomax Bren': {
      text: 'Once per round, after you discard an %ELITE% Upgrade card, flip that card faceup.'
    },
    'Ello Asty': {
      text: 'While you are not stressed, you may treat your %TROLLLEFT% and %TROLLRIGHT% maneuvers as white maneuvers.'
    },
    "Valen Rudor": {
      text: "After defending, you may perform a free action."
    },
    "4-LOM": {
      text: "At the start of the End phase, you may assign 1 of your stress tokens to another ship at Range 1."
    },
    "Tel Trevura": {
      text: "The first time you would be destroyed, instead cancel any remaining damage, discard all Damage cards, and deal 4 facedown Damage cards to this ship."
    },
    "Manaroo": {
      text: "At the start of the Combat phase, you may assign all focus, evade, and target lock tokens assigned to you to another friendly ship."
    }
  };
  upgrade_translations = {
    "Determination": {
      name: "Determinacja",
      text: "Kiedy otrzymujesz odkrytą kartę uszkodzenia z cechą \"Pilot\", natychmiast ją odrzuć bez rozpatrywania jej efektu."
    },
    "Swarm Tactics": {
      name: "Taktyka roju",
      text: "Na początku fazy walki wybierz 1 przyjazny statek w Zasięgu 1. Do końca tej fazy traktuj wybrany statek, jakby jego wartość umiejętności pilota była równa twojej."
    },
    "Squad Leader": {
      name: "Dowódca eskadry",
      text: "<strong>Akcja:</strong> Wybierz 1 statek w Zasięgu 1-2, który ma niższą wartość umiejętności pilota niż ty. %LINEBREAK% Wybrany statek może natychmiast wykonać 1 darmową akcję."
    },
    "Expert Handling": {
      name: "Mistrzowskie manewrowanie",
      text: "„<strong>Akcja:</strong> Wykonaj darmową akcję „beczka”. Jeśli nie masz symbolu akcji %BARRELROLL%, otrzymujesz 1 żeton stresu. Następnie możesz usunąć jeden wrogi żeton namierzonego celu znajdujący się na Twoim statku."
    },
    "Marksmanship": {
      name: "Celność",
      text: "<strong>Akcja:</strong> Kiedy atakujesz w tej rundzie, możesz zamienić 1 swój wynik %FOCUS% na %CRIT%, a wszystkie pozostałe wyniki %FOCUS% na %HIT%."
    },
    "Daredevil": {
      name: "Ryzykant",
      text: "<strong>Akcja:</strong> Wykonaj biały manewr (%TURNLEFT% 1) lub (%TURNRIGHT% 1)\". Następnie otrzymujesz żeton stresu. %LINEBREAK% Następnie, jeśli nie masz symbolu akcji %BOOST%, rzuć 2 kośćmi ataku. Otrzymujesz wszystkie wyrzucone uszkodzenia %HIT% i uszkodzenia krytyczne %CRIT%."
    },
    "Elusiveness": {
      name: "Nieuchwytność",
      text: "Kiedy się bronisz możesz otrzymać 1 żeton stresu, aby wybrać jedną kość ataku. Atakujący musi przerzucić tą kość. Nie możesz skorzystać z tej zdolności, jeśli jeśli masz co najmniej 1 żeton stresu."
    },
    "Push the Limit": {
      name: "Na granicy ryzyka",
      text: "Raz na rundę po wykonaniu akcji, możesz wykonać 1 darmową akcję przedstawioną na twoim pasku akcji. Następnie otrzymujesz 1 żeton stresu."
    },
    "Deadeye": {
      name: "Strzelec wyborowy",
      text: "Możesz traktować nagłówek <strong>\"Atak (namierzony cel):\"</strong> jako <strong>\"Atak (skupienie):\"</strong>. %LINEBREAK% Kiedy atak zmusza cię do wydania żetonu namierzonego celu, możesz zamiast niego wydać żeton skupienia."
    },
    "Expose": {
      name: "Odsłonięcie",
      text: "<strong>Akcja:</strong> Do końca rundy zwiększ wartość swojej podstawowej broni o 1 i zmniejsz wartość zwrotności o 1."
    },
    "Wingman": {
      name: "Skrzydłowy",
      text: "Na początku fazy walki usuń 1 żeton stresu z innego przyjaznego statku w Zasięgu 1."
    },
    "Decoy": {
      name: "Zmyłka",
      text: "Na początku fazy walki możesz wybrać 1 przyjazny statek w Zasięgu 1-2. Do końca fazy zamieniasz się z danym statkiem wartościami umiejętności pilota."
    },
    "Outmaneuver": {
      name: "Wymanewrowanie",
      text: "Kiedy atakujesz statek w swoim polu rażenia, a nie znajdujesz się w polu rażenia danego statku, zmniejsz jego wartość zwrotności o 1 (do minimum 0)."
    },
    "Predator": {
      name: "Drapieżnik",
      text: "Kiedy atakujesz, możesz przerzucić 1 kość ataku. Jeśli wartość umiejętnosci pilota obrońcy wynosi \"2\" lub mniej, możesz przerzucić maksymalnie 2 kości ataku (zamiast 1)."
    },
    "Draw Their Fire": {
      name: "Ściągnięcie ognia",
      text: "Kiedy przyjazny statek w Zasięgu 1 zostaje trafiony podczas ataku, możesz zamiast niego otrzymać 1 z nie anulowanych %CRIT%."
    },
    "Adrenaline Rush": {
      name: "Zastrzyk adrenaliny",
      text: "Kiedy ujawnisz czerwony manewr, możesz odrzucić tę kartę, aby do końca fazy aktywacji traktować ten manewr jako biały."
    },
    "Veteran Instincts": {
      name: "Instynkt weterana",
      text: "Zwiększ swoją wartość umiejętności pilota o 2."
    },
    "Opportunist": {
      name: "Oportunista",
      text: "Kiedy atakujesz, jeśli obrońca nie ma żadnych żetonów skupienia ani uników, możesz otrzymać 1 żeton stresu aby rzucić 1 dodatkową kością ataku.%LINEBREAK%Nie możesz skorzystać z tej zdolności, jeśli posiadasz żetony stresu."
    },
    "Lone Wolf": {
      name: "Samotny wilk",
      text: "Jeśli w zasięgu 1-2 nie ma żadnych innych przyjaznych statków, kiedy się bronisz lub atakujesz, możesz przerzucić 1 wynik z pustą ścianką."
    },
    "Stay On Target": {
      name: "Utrzymać cel",
      text: "Kiedy ujawnisz swój manewr możesz obrócić swój wskaźnik na inny manewr o tej samej prędkości.%LINEBREAK%Traktuj ten manewr jako czerwony."
    },
    "Ruthlessness": {
      name: "Bezwzględność",
      text: "%PL_IMPERIALONLY%%LINEBREAK% Po tym jak przeprowadzisz atak, który trafi w cel, musisz wybrać 1 inny statek w Zasięgu 1 od obrońcy (nie siebie). Statek ten otrzymuje 1 uszkodzenie."
    },
    "Intimidation": {
      name: "Zastraszenie",
      text: "Dopóki stykasz się z wrogim statkiem, jego zwrotność zostaje zmniejszona o 1."
    },
    "Calculation": {
      name: "Kalkulacje",
      text: "Kiedy atakujesz, możesz wydać żeton skupienia, aby zmienić jeden ze swoich wyników %FOCUS% na wynik %CRIT%."
    },
    "Bodyguard": {
      name: "Ochroniarz",
      text: "%PL_SCUMONLY%%LINEBREAK% Na początku fazy walki możesz wydać żeton skupienia aby wybrać przyjazny statek w Zasięgu 1 o wartości umiejętności pilota wyższej od ciebie. Do końca rundy zwiększ jego wartość zwrotności o 1."
    },
    "R2 Astromech": {
      name: "Astromech R2",
      text: "Możesz traktować wszystkie manewry o prędkości 1 i 2, jakby były to zielone manewry."
    },
    "R2-D2": {
      text: "Po wykonaniu zielonego manewru możesz odzyskać 1 osłonę (nie przekraczając swojej wartości osłon)."
    },
    "R2-F2": {
      text: "<strong>Akcja:</strong> Do końca tej rundy zwiększ swoją wartość zwrotności o 1."
    },
    "R5-D8": {
      text: "<strong>Akcja:</strong> Rzuć jedną kością obrony.%LINEBREAK% Jeżeli wypadnie wynik %EVADE% lub %FOCUS%, odrzuć jedną ze swoich zakrytych kart uszkodzeń."
    },
    "R5-K6": {
      text: "Po wydaniu swojego rzetonu namierzonego celu rzuć 1 kością obrony.%LINEBREAK% Jeżeli wypadnie %EVADE% natychmiast zdobywasz żeton namierzonego celu dla tego samego statku. Nie możesz wydać nowego żetonu namierzonego celu podczas tego ataku."
    },
    "R5 Astromech": {
      name: "Astromech R5",
      text: "Podczas fazy końcowej możesz wybrać 1 ze swoich odkrytych kart z cechą \"Statek\" i ją zakryć."
    },
    "R7 Astromech": {
      name: "Astromech R7",
      text: "Raz na rundę kiedy się bronisz, jeśli namierzasz atakującego, możesz wydać żeton namierzonego celu aby wybrać dowolną liczbę kości ataku. Atakujący musi przerzucić wybrane kości."
    },
    "R7-T1": {
      text: "<strong>Akcja:</strong> Wybierz wrogi statek w Zasięgu 1-2. Jeżeli znajdujesz się w polu rażenia wybranego statku, możesz namierzyć dany statek. Następnie możesz wykonać darmową akcję \"dopalacz\"."
    },
    "R4-D6": {
      text: "Kiedy zostaniesz trafiony w wyniku ataku, a pośród wyników rzutu są co najmniej 3 nieaulowalne wyniki %HIT% możesz wybrać i anulować wszystkie poza 2. Za każdy wynik anulowany w ten sposób otrzymujesz 1 żeton stresu."
    },
    "R5-P9": {
      text: "Na koniec fazy walki możesz wydać jeden ze swoich żetonów skupienia, aby odzyskać 1 osłonę (nie przekraczając swojej wartości osłon)."
    },
    "R3-A2": {
      text: "Kiedy wybierzesz cel ataku, jeżeli obrońca znajduje się w twoim polu rażenia, możesz otrzymać 1 żeton stresu, aby sprawić żeby obrońca otrzymał 1 żeton stresu."
    },
    "R2-D6": {
      text: "Twój pasek rowinięć zyskuje symbol %ELITE%.%LINEBREAK% Nie możesz przypisać tej karty rozwinięcia do swojego statku jeżeli masz już symbol rozwinięcia %ELITE% lub jeżeli wartość umiejętności pilota wynosi 2 lub mniej."
    },
    "Proton Torpedoes": {
      name: "Torpedy protonowe",
      text: "<strong>Atak (namierzony cel):</strong> Wydaj swój żeton namierzonego celu i odrzuć tę kartę, aby wykonać ten atak. %LINEBREAK%Możesz zmienić 1 ze swoich wyników %FOCUS% na wynik %CRIT%."
    },
    "Advanced Proton Torpedoes": {
      name: "Zaaw. torpedy protonowe",
      text: "<strong>Atak (namierzony cel):</strong> Wydaj swój żeton namierzonego celu i odrzuć tę kartę, aby wykonać ten atak. %LINEBREAK%Możesz zmienić maksymalnie 3 swoje puste ścianki na wyniki %FOCUS%."
    },
    "Flechette Torpedoes": {
      name: "Torpedy rozpryskowe",
      text: "<strong>Atak (namierzony cel):</strong> Wydaj swój żeton namierzonego celu i odrzuć tę kartę, aby wykonać ten atak. %LINEBREAK%Po wykonaniu tego ataku obrońca otrzymuje 1 żeton stresu jeżeli jego wartość kadłuba wynosi 4 lub mniej."
    },
    "Ion Torpedoes": {
      name: "Torpedy jonowe",
      text: "<strong>Atak (namierzony cel):</strong> Wydaj swój żeton namierzonego celu i odrzuć tę kartę, aby wykonać ten atak. %LINEBREAK%Jeżeli ten atak trafi w wybrany cel, obrońca oraz każdy statek w Zasięgu 1 od niego otrzymuje 1 żeton jonów."
    },
    "Bomb Loadout": {
      name: "Ładunek bomb",
      text: "<span class=\"card-restriction\">Tylko Y-wing. Ograniczenie.</span>%LINEBREAK%Twój pasek rozwinięć zyskuje symbol %BOMB%."
    },
    "Ion Cannon Turret": {
      name: "Wieżyczka z działem jonowym",
      text: "<strong>Atak:</strong> Zaatakuj 1 statek (nawet poza twoim polem rażenia). %LINEBREAK%Jeśli atak ten trafi w wybrany statek, otrzymuje on 1 uszkodzenie oraz 1 żeton jonów. Następnie anuluj wszystkie wyniki kości."
    },
    "Blaster Turret": {
      name: "Wieżyczka blasterowa",
      text: "<strong>Atak (skupienie):</strong> Wydaj 1 żeton skupienia, aby zaatakować 1 statek (nawet poza twoim polem rażenia)."
    },
    "Autoblaster Turret": {
      name: "Wieżyczka autoblasterowa",
      text: "<strong>Atak: Zaatakuj 1 statek (nawet poza twoim polem rażenia). %LINEBREAK%Twoje wyniki %HIT% nie mogą być anulowane przy pomocy kości obrony. Obrońca może anulować wyniki %CRIT% przed %HIT%."
    },
    "Concussion Missiles": {
      name: "Rakiety wstrząsowe",
      text: "<strong>Atak (namierzony cel):</strong> Wydaj swój żeton namierzonego celu i odrzuć tę kartę, aby wykonać ten atak. %LINEBREAK%Możesz zmienić 1 ze swoich wyników z pustą ścianką na wynik %HIT%."
    },
    "Cluster Missiles": {
      name: "Rakiety kasetonowe",
      text: "<strong>Atak (namierzony cel):</strong> Wydaj swój żeton namierzonego celu o odrzuć tę kartę, aby przeprowadzić ten atak dwukrotnie."
    },
    "Homing Missiles": {
      name: "Rakiety samonaprowadzające",
      text: "<strong>Atak (namierzony cel):</strong> Odrzuć tę kartę, aby wykonać ten atak. %LINEBREAK%Podczas tego ataku obrońca nie może wydawać żetonów uniku."
    },
    "Assault Missiles": {
      name: "Rakiety szturmowe",
      text: "<strong>Atak (namierzony cel):</strong> Wydaj swój żeton namierzonego celu i odrzuć tę kartę, aby wykonać ten atak. %LINEBREAK%Jeśli ten atak trafi w wybrany cel, każdy inny statek w Zasięgu 1 od obrońcy otrzymuje 1 uszkodzenie."
    },
    "Ion Pulse Missiles": {
      name: "Jonowe rakiety pulsacyjne",
      text: "<strong>Atak (namierzony cel):</strong> Odrzuć tę kartę, aby wykonać ten atak. %LINEBREAK%Jeśli ten atak trafi, obrońca otrzymuje 1 uszkodzenie oraz 2 żetony jonów."
    },
    "Chardaan Refit": {
      name: "Naprawy na Chardaanie",
      text: "<span class=\"card-restriction\">Tylko A-wing.</span>%LINEBREAK%Ta karta ma ujemny koszt w punktach eskadry."
    },
    "Proton Rockets": {
      name: "Rakiety protonowe",
      text: "<strong>Atak (skupienie):</strong> Odrzuć tę kartę, aby wykonać ten atak. %LINEBREAK%Możesz rzucić dodatkowymi kośćmi ataku w liczbie równej twojej zwrotności (nie wiecej niż 3)."
    },
    "Seismic Charges": {
      name: "Ładunki sejsmiczne",
      text: "Kiedy odkrywasz swój wskaźnik manewrów, możesz odrzucić tą kartę aby zrzucić 1 żeton ładunku sejsmicznego. %LINEBREAK%Żeton ten zostanie zdetonowany na koniec fazy aktywacji."
    },
    "Proximity Mines": {
      name: "Miny zbliżeniowe",
      text: "<strong>Akcja:</strong> odrzuć tę kartę aby zrzucić 1 żeton miny zbliżeniowej. Kiedy statek wykona manewr w wyniku którego podstawka statku lub wzornik manewru będzie nachodzić na ten żeton, żeton ten zostaje zdetonowany."
    },
    "Proton Bombs": {
      name: "Bomby protonowe",
      text: "Kiedy odkrywasz swój wskaźnik manewrów, możesz odrzucić tą kartę aby zrzucić 1 żeton bomby protonowej. %LINEBREAK%Żeton ten zostanie zdetonowany na koniec fazy aktywacji."
    },
    "Ion Cannon": {
      name: "Działo Jonowe",
      text: "<strong>Atak: Zaatakuj 1 statek. %LINEBREAK%Jeżeli ten atak trafi wybrany cel, obrońca otrzymuje 1 uszkodzenie oraz 1 żeton jonów. Następnie anuluj wszystie wyniki kości."
    },
    "Heavy Laser Cannon": {
      name: "Ciężkie działo laserowe",
      text: "<strong>Atak: Zaatakuj 1 statek. %LINEBREAK%Natychmiast po rzucie swoimi kośćmi ataku musisz zmienić wszystkie swoje wyniki %CRIT% na wyniki %HIT%."
    },
    "Autoblaster": {
      text: "<strong>Atak: Zaatakuj 1 statek. %LINEBREAK%Twoje wyniki %HIT% nie mogą być anulowane przez kości obrony. Obrońca może anulować wyniki %CRIT% przed wynikami %HIT%."
    },
    "Flechette Cannon": {
      name: "Działo rozpryskowe",
      text: "<strong>Atak: Zaatakuj 1 statek. %LINEBREAK%Jeżeli ten atak trafi, obrońca otrzymuje 1 uszkodzenie i, jeśli nie jest zestresowany, otrzymuje także 1 żeton stresu. Następnie anuluj wszystkie wyniki kości."
    },
    '"Mangler" Cannon': {
      name: "Działo typu Mangler",
      text: "<strong>Atak: Zaatakuj 1 statek. %LINEBREAK%Kiedy atakujesz, możesz zmienić jeden ze swoich wyników %HIT% na wynik %CRIT%."
    },
    "Enhanced Scopes": {
      name: "Wzmocnione radary",
      text: "Podczas fazy aktywacji traktuj swoją wartość umiejętności pilota jakby wynosiła \"0\"."
    },
    "Fire-Control System": {
      name: "System kontroli ognia",
      text: "Po tym jak wykonasz atak, możesz namierzyć obroncę."
    },
    "Advanced Sensors": {
      name: "Zaawanswowane sensory",
      text: "Zaraz przed tym jak ujawnisz swój manewr, możesz wykonać 1 darmową akcję. %LINEBREAK%Jeżeli skorzystawsz z tej zdolności, musisz w tej rundzie pominąć swój krok \"Wykonywania akcji\"."
    },
    "Sensor Jammer": {
      name: "Zakłócacz sensorów",
      text: "Kiedy się bronisz możesz zmienić 1 z wyników %HIT% atakującego na wynik %FOCUS%. Atakujący nie może przerzucić kości ze zmienionym wynikiem."
    },
    "Accuracy Corrector": {
      name: "Korektor celności",
      text: "Kiedy atakujesz, możesz anulować wszystkie swoje wyniki kości. Następnie możesz dodać 2 wyniki %HIT%.%LINEBREAK% Podczas tego ataku nie można ponownie modyfikować twoich kości."
    },
    "Advanced Targeting Computer": {
      name: "Zaawansowany komputer celowniczy",
      text: "<span class=\"card-restriction\">Tylko TIE Advanced.</span>%LINEBREAK% Kiedy atakujesz namierzonego przez siebie przeciwnika przy pomocy broni podstawowej, do wyniku rzutu kośćmi możesz dodać jeden wynik %CRIT%. Jeżeli to zrobisz, podczas tego ataku nie możesz wydać żetonu namierzonego celu."
    },
    "Gunner": {
      name: "Artylerzysta",
      text: "Po wykonaniu ataku, który nie trafił w wybrany cel, natychmiast wykonaj atak główną bronią. W tej rundzie nie możesz wykonać kolejnego ataku."
    },
    "Mercenary Copilot": {
      name: "Najemny drugi pilot",
      text: "Kiedy atakujesz w Zasiegu 3 możesz zmienić 1 ze swoich wyników %HIT% na wynik %CRIT%."
    },
    "Weapons Engineer": {
      name: "Inżynier uzbrojenia",
      text: "Możesz namierzać naraz 2 statki (każdy wrogi statek możesz namierzać tylko raz). %LINEBREAK%Kiedy namierzasz cel, możesz namierzyć 2 różne statki."
    },
    "Luke Skywalker": {
      text: "%PL_REBELONLY%%LINEBREAK%Po wykonaniu ataku, który nie trafi w wybrany cel, natychmiast wykonaj atak główną bronią. Możesz zmienić 1 wynik %FOCUS% na %HIT%."
    },
    "Nien Nunb": {
      text: "%PL_REBELONLY%%LINEBREAK%Możesz traktować wszystkie manewry %STRAIGHT%, jakby były to zielone manewry."
    },
    "Chewbacca": {
      text: "%PL_REBELONLY%%LINEBREAK%Kiedy otrzymujesz kartę uszkodzenia, możesz natychmiast odrzucić tę kartę i odzyskać 1 żeton osłony. Następnie odrzuć tę kartę rozwinięcia."
    },
    "Recon Specialist": {
      name: "Specjalista zwiadu",
      text: "Kiedy wykonujesz akcję skupienia, przypisz do swojego statku 1 dodatkowy żeton skupienia."
    },
    "Saboteur": {
      name: "Sabotażysta",
      text: "<strong>Akcja:</strong> Wybierz 1 wrogi statek w Zasięgu 1 i rzuć 1 koscią ataku. Jeśli wypadnie %HIT% lub %CRIT%, wylosuj 1 zakrytą kartę uszkodzenia przypisaną do tego statku, odkryj ją i rozpatrz."
    },
    "Intelligence Agent": {
      name: "Agent wywiadu",
      text: "Na początku fazy aktywacji wybierz 1 wrogi statek w zasięgu 1-2. Możesz podejrzeć manewr wybrany przez ten statek."
    },
    "Darth Vader": {
      text: "%PL_IMPERIALONLY%%LINEBREAK%Tylko Imperium. Po tym jak wykonasz atak skierowany przeciwko wrogiemu statkowi, możesz otrzymać 2 uszkodzenia, aby zadać temu statkowi 1 krytyczne uszkodzenie."
    },
    "Rebel Captive": {
      name: "Rebeliancki jeniec",
      text: "%PL_IMPERIALONLY%%LINEBREAK%Raz na rundę, pierwszy statek, który zadeklaruje ciebie jako cel ataku, natychmiast otrzymuje 1 żeton stresu."
    },
    "Flight Instructor": {
      name: "Instruktor pilotażu",
      text: "Kiedy się bronisz, możesz przerzucić 1 ze swoich wyników %FOCUS%. Jeśli wartość umiejętności atakującego pilota wynosi \"2\" lub mniej, zamiast tego przerzuć 1 ze swoich pustych scianek.%FOCUS%."
    },
    "Navigator": {
      name: "Nawigator",
      text: "Kiedy ujawnisz swój manewr, możesz obrócić swój wskaźnik na inny manewr tego samego kierunku. %LINEBREAK%Nie możesz przekręcić wskaźnika na czerwony manewr, jeśli posiadasz jakieś żetony stresu."
    },
    "Lando Calrissian": {
      text: "%PL_REBELONLY%%LINEBREAK%<strong>Akcja:</strong> Rzuć 2 koścmi obrony. Za kazdy uzyskany wynik %FOCUS% przypisz do swojego statku 1 żeton skupienia. Za każdy wynik %EVADE% przypisz do swojego statku 1 żeton uniku.%FOCUS%"
    },
    "Mara Jade": {
      text: "%PL_IMPERIALONLY%%LINEBREAK% Na koniec fazy walki kazdy wrogi statek w Zasięgu 1, który nie ma żetonu stresu, otrzymuje żeton stresu."
    },
    "Fleet Officer": {
      name: "Oficer floty",
      text: "%PL_IMPERIALONLY%%LINEBREAK%<strong>Akcja:</strong> Wybierz maksymalnie 2 przyjazne statki w Zasięgu 1-2 i do każdego przypisz po 1 żetonie skupienia, następnie otrzymujesz 1 żeton stresu."
    },
    "Han Solo": {
      text: "%PL_REBELONLY%%LINEBREAK%Tylko rebelianci. Kiedy atakujesz, jeśli namierzyłeś obrońcę, możesz wydać żeton namierzonego celu aby zmienić wszystkie swoje wyniki %FOCUS% na %HIT%."
    },
    "Leia Organa": {
      text: "%PL_REBELONLY%%LINEBREAK%Na początku fazy aktywacji możesz odrzucić tę kartę, aby umożliwić wszystkim przyjaznym statkom, które ujawiniają czerwony manewr, traktowanie do końca fazy tego manewru jako białego."
    },
    "WED-15 Repair Droid": {
      name: "Droid naprawczy WED-15",
      text: "%PL_HUGESHIPONLY%%LINEBREAK%<strong>Akcja:</strong> Wydaj 1 żeton energii aby odrzucić 1 ze swoich zakrytych kart uszkodzeń albo wydaj 3 żetony energii aby odrzucić 1 ze swoich odkrytych kart uszkodzeń."
    },
    "Carlist Rieekan": {
      text: "%PL_HUGESHIPONLY% %PL_REBELONLY%%LINEBREAK%Na początku fazy aktywacji możesz odrzucić tę kartę aby do końca fazy traktować wartość umiejętności pilota każdego przyjaznego statku jakby wynosiła \"12\"."
    },
    "Jan Dodonna": {
      text: "%PL_HUGESHIPONLY% %PL_REBELONLY%%LINEBREAK%Kiedy inny przyjazny statek w Zasięgu 1 wykonuje atak, możesz zmienić 1 z jego wyników %HIT% na %CRIT%."
    },
    "Tactician": {
      name: "Taktyk",
      text: "Po tym jak wykonasz atak przeciwko statkowi znajdującemu się w twoim polu rażenia w Zasiegu 2, statek ten otrzymuje 1 żeton stresu."
    },
    "R2-D2 (Crew)": {
      name: "R2-D2 (Załoga)",
      text: "%PL_REBELONLY%%LINEBREAK%Na koniec fazy końcowej, jeśli nie masz żadnych osłon, możesz odzyskać 1 osłonę i rzucić 1 kością ataku. Jeśli wypadnie %HIT% odkryj 1 losową ze swoich zakrytych kart uszkodzeń i ją rozpatrz."
    },
    "C-3PO": {
      text: "%PL_REBELONLY%%LINEBREAK%Raz na rundę, zanim wykonasz rzut co najmniej 1 koscią obrony, możesz na głos zgadnąć liczbę wyników %EVADE%. Jeśli wypadło tyle %EVADE% (przed modyfikacjami) dodaj 1 wynik %EVADE%."
    },
    "Kyle Katarn": {
      text: "%PL_REBELONLY%%LINEBREAK%Po tym jak usuniesz ze swojego statku żeton stresu, możesz przypisać do swojego statku żeton skupienia."
    },
    "Jan Ors": {
      text: "%PL_REBELONLY%%LINEBREAK%Raz na rundę, kiedy przyjazny statek w Zasięgu 1-3 wykonuje akcję skupienia lub miałby otrzymać żeton skupienia, możesz danemu statkowi przypisać żeton uniku (zamiast skupienia)."
    },
    "Toryn Farr": {
      text: "%PL_HUGESHIPONLY% %PL_REBELONLY%%LINEBREAK%<strong>Akcja:</strong> Wydaj dowolną ilość żetonów energii aby wybrać taką samą liczbę wrogich statków w Zasiegu 1-2. Usuń z wybranych statków wszystkie żetony skupienia, uników i niebieskie żetony namierzonego celu."
    },
    "Targeting Coordinator": {
      name: "Koordynator namierzania",
      text: "<strong>Energia:</strong> Możesz wydać 1 żeton energii aby wybrać 1 przyjazny statek w Zasięgu 1-2. Namierz cel, a następnie przydziel do wybranego statku niebieski żeton namierzonego celu."
    },
    "Raymus Antilles": {
      text: "%PL_HUGESHIPONLY% %PL_REBELONLY%%LINEBREAK%Na początku fazy aktywacji wybierz 1 wrogi statek w Zasięgu 1-3. Możesz podejrzeć manewr wybrany dla tego statku. Jeżeli jest on biały, przydziel do niego 1 żeton stresu."
    },
    '"Leebo"': {
      text: "%PL_REBELONLY%%LINEBREAK%<strong>Akcja:</strong> wykonaj darmową akcję \"dopalacz\". Następnie otrzymujesz 1 żeton jonów."
    },
    "Dash Rendar": {
      text: "%PL_REBELONLY%%LINEBREAK%Możesz wykonywać ataki kiedy nachodzisz na przeszkodę. %LINEBREAK%Twoje ataki nie mogą być przyblokowane."
    },
    "Ysanne Isard": {
      text: "%PL_IMPERIALONLY%%LINEBREAK%Na początku fazy walki, jeśli nie masz żadnych osłon, a do twojego statku przypisana jest co najmniej 1 karta uszkodzenia, możesz wykonać darmową akcję unik."
    },
    "Moff Jerjerrod": {
      text: "%PL_IMPERIALONLY%%LINEBREAK%Kiedy otrzymujesz odkrytą kartę uszkodzenia, możesz odrzucić to rozwinięcie lub inną kartę rozwinięcia [crew] aby zakryć tę kartę uszkodzenia (bez rozpatrywania jej efektu)."
    },
    "Greedo": {
      text: "%PL_SCUMONLY%%LINEBREAK%Za pierwszym razem kiedy atakujesz lub bronisz sie w każdej rundzie, pierwsza przypisana karta uszkodzenia jest odkryta."
    },
    "Outlaw Tech": {
      name: "Mechanik wyjęty spod prawa",
      text: "%PL_SCUMONLY%%LINEBREAK%Po wykonaniu czerwonego manewru, możesz przypisać do swojego statku 1 żeton skupienia."
    },
    "K4 Security Droid": {
      name: "Droid ochroniarz K4",
      text: "%PL_SCUMONLY%%LINEBREAK%Po wykonaniu zielonego manewru możesz namierzyć cel."
    },
    "Frequency Jammer": {
      name: "Zakłócacz częstotliwości",
      text: "Kiedy wykonujesz akcję Zakłócanie, wybierz 1 wrogi statek, który nie ma żetonu stresu i znajduje się w Zasięgu 1 od zakłócanego statku. Wybrany statek otrzymuje 1 żeton stresu."
    },
    "Expanded Cargo Hold": {
      ship: "Średni transportowiec GR-75",
      name: "Powiększona ładownia",
      text: "<span class=\"card-restriction\">Tylko GR-75.</span>%LINEBREAK%Raz na rundę, kiedy masz otrzymać odkrytą kartę uszkodznia, możesz dobrać te kartę z talii uszkodzeń dziobu lub rufy."
    },
    "Comms Booster": {
      name: "Wzmacniacz łączności",
      text: "<strong>Energia:</strong> Wydaj 1 żeton energii aby usunąć wszystkie żetony stresu z przyjaznego statku w Zasięgu 1-3, następnie przydziel do tego statku 1 żeton skupienia."
    },
    "Slicer Tools": {
      name: "Narzędzia hakera",
      text: "<strong>Akcja:</strong> Wybierz co najmniej 1 wrogi statek w Zasięgu 1-3, na ktorym znajduje się żeton stresu. Za każdy wybrany statek możesz wydać 1 żeton energii aby sprawić, żeby dany statek otrzymał 1 uszkodzenie."
    },
    "Shield Projector": {
      name: "Projektor osłon",
      text: "Kiedy wrogi statek stanie się podczas fazy walki, możesz wydać 3 żetony energii aby do końca fazy zmusić go do zaatakowania ciebie, jeśli to możliwe."
    },
    "Tibanna Gas Supplies": {
      name: "Zapasy gazu Tibanna",
      text: "<strong>Energia:</strong> Możesz odrzucić tę kartę aby otrzymać 3 żetony energii."
    },
    "Ionization Reactor": {
      name: "Reaktor jonizacyjny",
      text: "<strong>Energia:</strong> Wydaj 5 żetonów energii z tej karty i odrzuć tą kartę aby sprawić żeby każdy statek w Zasięgu 1 otrzymał 1 uszkodzneie i 1 żeton jonów."
    },
    "Engine Booster": {
      name: "Dopalacz silnika",
      text: "Tuż przed tym jak odkryjesz swój wskaźnik manewrów, możesz wydać 1 żeton energii aby wykonać biały manewr (%STRAIGHT% 1). Nie możesz skorzystać z tej zdolności, jeśli w jej wyniku będziesz nachodzić na inny statek."
    },
    "Backup Shield Generator": {
      name: "Zapasowy generator osłon",
      text: "Na koniec każdej rudny możesz wydać 1 żeton energii aby odzyskać 1 osłonę (nie przekraczając swojej wartości osłon)."
    },
    "EM Emitter": {
      name: "Emiter elektro-magnetyczny",
      text: "Kiedy przyblokujesz atak, obrońca rzuca 3 dodatkowymi kośmi obrony (zamiast 1)."
    },
    "Ion Cannon Battery": {
      name: "Bateria działa jonowego",
      text: "<strong>Atak (energia):</strong> Aby wykonać ten atak, wydaj 2 żetony energii z tej karty. Jeżeli atak ten trafi w wybrany statek, otrzymuje on 1 krytyczne uszkodzenie oraz 1 żeton jonów. Następnie anuluj wszystkie wyniki kości."
    },
    "Single Turbolasers": {
      name: "Pojedyńcze Turbolasery",
      text: "<strong>Atak (energia):</strong> Wydaj 2 żetony energii z tej karty aby wykonać ten atak. Obronca podwaja swoją wartość zwrotności przeciwko temu atakowi. Możesz zmienić jeden ze swoich wyników %FOCUS% na %HIT%."
    },
    "Quad Laser Cannons": {
      name: "Poczwórne działka laserowe",
      text: "<strong>Atak (energia):</strong> Wydaj 1 żeton energii z tej karty aby wykonać ten atak. Jeśli ten atak nie trafi, możesz natychmiast wydać 1 żeton energii z tej karty aby ponownie przeprowadzić ten atak."
    },
    "Gunnery Team": {
      name: "Zespół artylerzystów",
      text: "Raz na rundę kiedy atakujesz przy pomocy daodatkowej broni, możesz wydać 1 żeton energii aby zmienić 1 ze swoich pustych wyników na %HIT%."
    },
    "Sensor Team": {
      name: "Zespół obsługi sensorów",
      text: "Kiedy namierzasz cel, możesz namierzyć wrogi statek w Zasięgu 1-5 (zamiast Zasięgu 1-3)."
    },
    "Engineering Team": {
      name: "Zespół techników",
      text: "Podczas fazy aktywacji, kiedy ujawnisz manewr %STRAIGHT%, otrzymujesz 1 dodatkowy żeton energii podczas kroku Otrzymywania energii."
    },
    "Inertial Dampeners": {
      name: "Tłumiki inercyjne",
      text: "Kiedy ujawniasz swój manewr, możesz odrzucić tę kartę żeby zamiast tego wykonać biały manewr [0%STOP%]. Następnie otrzymujesz 1 żeton stresu."
    },
    "Dead Man's Switch": {
      name: "Włącznik samobójcy",
      text: "Kiedy zostajesz zniszczony, każdy statek w Zasięgu 1 otrzymuje 1 uszkodzenie."
    },
    "Feedback Array": {
      name: "System zwrotny",
      text: "Podczas fazy walki, zamiast wykonywać jakiekolwiek ataki, możesz otrzymać 1 żeton jonów i 1 uszkodzenie aby wybrać wrogi statek w Zasięgu 1. Wybrany statek otrzymuje 1 uszkodzenie."
    },
    '"Hot Shot" Blaster': {
      name: "Gorący strzał",
      text: "<strong>Atak:</strong> Odrzuć tę kartę, aby zaatakować 1 statek (nawet poza twoim polem rażenia)."
    },
    "Salvaged Astromech": {
      name: "Astromech z odzysku",
      text: "Kiedy otrzymujesz kartę uszkodzenia z cechą Statek, natychmiast możesz ją odrzucić (przed rozpatrzeniem efektu). %LINEBREAK%Następnie odrzuć tę kartę rozwinięcia.%LINEBREAK%."
    },
    '"Genius"': {
      name: "Geniusz",
      text: "Jeśli jesteś wyposażony w bombę, która może zostać zrzucona przed ujawnieniem twojego manewru, zamiast tego możesz ją zrzucić po tym jak wykonasz swój manewr."
    },
    "Unhinged Astromech": {
      name: "Szalony astromech",
      text: "Możesz traktować manewry o prędkości 3 jako zielone."
    },
    "R4-B11": {
      text: "Kiedy atakujesz namierzonego przez siebie obrońcę, możesz wydać żeton namierzonego celu aby wybrać dowolne kości obrony (nawet wszystkie). Następnie obrońca musi przerzucić wybrane przez ciebie kości."
    },
    "R4 Agromech": {
      name: "Agromech R4",
      text: "Kiedy atakujesz, po wydaniu żetonu skupienia, możesz namierzyć obrońcę."
    },
    "Emperor Palpatine": {
      text: "%IMPERIALONLY%%LINEBREAK%Once per round, you may change a friendly ship's die result to any other die result.  That die result cannot be modified again."
    },
    "Bossk": {
      text: "%SCUMONLY%%LINEBREAK%After you perform an attack that does not hit, if you are not stressed, you <strong>must</strong> receive 1 stress token. Then assign 1 focus token to your ship and acquire a target lock on the defender."
    },
    "Lightning Reflexes": {
      text: "%SMALLSHIPONLY%%LINEBREAK%After you execute a white or green maneuver on your dial, you may discard this card to rotate your ship 180&deg;.  Then receive 1 stress token <strong>after</strong> the \"Check Pilot Stress\" step."
    },
    "Twin Laser Turret": {
      text: "<strong>Attack:</strong> Perform this attack <strong>twice</strong> (even against a ship outside your firing arc).<br /><br />Each time this attack hits, the defender suffers 1 damage.  Then cancel <strong>all</strong> dice results."
    },
    "Plasma Torpedoes": {
      text: "<strong>Attack (target lock):</strong> Spend your target lock and discard this card to perform this attack.<br /><br />If this attack hits, after dealing damage, remove 1 shield token from the defender."
    },
    "Ion Bombs": {
      text: "When you reveal your maneuver dial, you may discard this card to <strong>drop</strong> 1 ion bomb token.<br /><br />This token <strong>detonates</strong> at the end of the Activation phase.<br /><br /><strong>Ion Bombs Token:</strong> When this bomb token detonates, each ship at Range 1 of the token receives 2 ion tokens.  Then discard this token."
    },
    "Conner Net": {
      text: "<strong>Action:</strong> Discard this card to <strong>drop</strong> 1 Conner Net token.<br /><br />When a ship's base or maneuver template overlaps this token, this token <strong>detonates</strong>.<br /><br /><strong>Conner Net Token:</strong> When this bomb token detonates, the ship that moved through or overlapped this token suffers 1 damage, receives 2 ion tokens, and skips its \"Perform Action\" step.  Then discard this token."
    },
    "Bombardier": {
      text: "When dropping a bomb, you may use the (%STRAIGHT% 2) template instead of the (%STRAIGHT% 1) template."
    },
    "Cluster Mines": {
      text: "<strong>Action:</strong> Discard this card to <strong>drop</strong> 3 cluster mine tokens.<br /><br />When a ship's base or maneuver template overlaps a cluster mine token, that token <strong>detonates</strong>.<br /><br /><strong>Cluster Mines Tokens:</strong> When one of these bomb tokens detonates, the ship that moved through or overlapped this token rolls 2 attack dice and suffers all damage (%HIT%) rolled.  Then discard this token."
    },
    'Crack Shot': {
      text: 'When attacking a ship inside your firing arc, you may discard this card to cancel 1 of the defender\'s %EVADE% results.'
    },
    "Advanced Homing Missiles": {
      text: "<strong>Attack (target lock):</strong> Discard this card to perform this attack.%LINEBREAK%If this attack hits, deal 1 faceup Damage card to the defender.  Then cancel <strong>all</strong> dice results."
    },
    'Agent Kallus': {
      text: '%IMPERIALONLY%%LINEBREAK%At the start of the first round, choose 1 enemy small or large ship.  When attacking or defending against that ship, you may change 1 of your %FOCUS% results to a %HIT% or %EVADE% result.'
    },
    'XX-23 S-Thread Tracers': {
      text: "<strong>Attack (focus):</strong> Discard this card to perform this attack.  If this attack hits, each friendly ship at Range 1-2 of you may acquire a target lock on the defender.  Then cancel <strong>all</strong> dice results."
    },
    "Tractor Beam": {
      text: "<strong>Attack:</strong> Attack 1 ship.%LINEBREAK%If this attack hits, the defender receives 1 tractor beam token.  Then cancel <strong>all</strong> dice results."
    },
    "Cloaking Device": {
      text: "%SMALLSHIPONLY%%LINEBREAK%<strong>Action:</strong> Perform a free cloak action.%LINEBREAK%At the end of each round, if you are cloaked, roll 1 attack die.  On a %FOCUS% result, discard this card, then decloak or discard your cloak token."
    },
    "Shield Technician": {
      text: "%HUGESHIPONLY%%LINEBREAK%When you perform a recover action, instead of spending all of your energy, you can choose any amount of energy to spend."
    },
    "Weapons Guidance": {
      text: "When attacking, you may spend a focus token to change 1 of your blank results to a %HIT% result."
    },
    "BB-8": {
      text: "When you reveal a green maneuver, you may perform a free barrel roll action."
    },
    "R5-X3": {
      text: "Before you reveal your maneuver, you may discard this card to ignore obstacles until the end of the round."
    },
    "Wired": {
      text: "When attacking or defending, if you are stressed, you may reroll 1 or more of your %FOCUS% results."
    },
    'Cool Hand': {
      text: 'When you receive a stress token, you may discard this card to assign 1 focus or evade token to your ship.'
    },
    'Juke': {
      text: '%SMALLSHIPONLY%%LINEBREAK%When attacking, if you have an evade token, you may change 1 of the defender\'s %EVADE% results into a %FOCUS% result.'
    },
    'Comm Relay': {
      text: 'You cannot have more than 1 evade token.%LINEBREAK%During the End phase, do not remove an unused evade token from your ship.'
    },
    'Dual Laser Turret': {
      text: '%GOZANTIONLY%%LINEBREAK%<strong>Attack (energy):</strong> Spend 1 energy from this card to perform this attack against 1 ship (even a ship outside your firing arc).'
    },
    'Broadcast Array': {
      text: '%GOZANTIONLY%%LINEBREAK%Your action bar gains the %JAM% action icon.'
    },
    'Rear Admiral Chiraneau': {
      text: '%HUGESHIPONLY% %IMPERIALONLY%%LINEBREAK%<strong>Action:</strong> Execute a white (%STRAIGHT% 1) maneuver.'
    },
    'Ordnance Experts': {
      text: 'Once per round, when a friendly ship at Range 1-3 performs an attack with a %TORPEDO% or %MISSILE% secondary weapon, it may change 1 of its blank results to a %HIT% result.'
    },
    'Docking Clamps': {
      text: '%GOZANTIONLY% %LIMITED%%LINEBREAK%You may attach 4 up to TIE fighters, TIE interceptors, TIE bombers, or TIE Advanced to this ship.  All attached ships must have the same ship type.'
    },
    '"Zeb" Orrelios': {
      text: "%REBELONLY%%LINEBREAK%Enemy ships inside your firing arc that you are touching are not considered to be touching you when either you or they activate during the Combat phase."
    },
    'Kanan Jarrus': {
      text: "%REBELONLY%%LINEBREAK%Once per round, after a friendly ship at Range 1-2 executes a white maneuver, you may remove 1 stress token from that ship."
    },
    'Reinforced Deflectors': {
      text: "%LARGESHIPONLY%%LINEBREAK%After you suffer 3 or more damage from an attack, recover one shield (up to your shield value)."
    },
    'Dorsal Turret': {
      text: "<strong>Attack:</strong> Attack 1 ship (even a ship outside your firing arc).%LINEBREAK%If the target of this attack is at Range 1, roll 1 additional attack die."
    },
    'Targeting Astromech': {
      text: 'After you execute a red maneuver, you may acquire a target lock.'
    },
    'Hera Syndulla': {
      text: "%REBELONLY%%LINEBREAK%You may reveal and execute red maneuvers even while you are stressed."
    },
    'Ezra Bridger': {
      text: "%REBELONLY%%LINEBREAK%When attacking, if you are stressed, you may change 1 of your %FOCUS% results to a %CRIT% result."
    },
    'Sabine Wren': {
      text: "%REBELONLY%%LINEBREAK%Your upgrade bar gains the %BOMB% upgrade icon.  Once per round, before a friendly bomb token is removed, choose 1 enemy ship at Range 1 of that token. That ship suffers 1 damage."
    },
    '"Chopper"': {
      text: "%REBELONLY%%LINEBREAK%You may perform actions even while you are stressed.%LINEBREAK%After you perform an action while you are stressed, suffer 1 damage."
    },
    'Construction Droid': {
      text: '%HUGESHIPONLY% %LIMITED%%LINEBREAK%When you perform a recover action, you may spend 1 energy to discard 1 facedown Damage card.'
    },
    'Cluster Bombs': {
      text: 'After defending, you may discard this card.  If you do, each other ship at Range 1 of the defending section rolls 2 attack dice, suffering all damage (%HIT%) and critical damage (%CRIT%) rolled.'
    },
    "Adaptability (+1)": {
      text: "<span class=\"card-restriction\">Dual card.</span>%LINEBREAK%Increase your pilot skill value by 1."
    },
    "Adaptability (-1)": {
      text: "<span class=\"card-restriction\">Dual card.</span>%LINEBREAK%Decrease your pilot skill value by 1."
    },
    "Electronic Baffle": {
      text: "When you receive a stress token or an ion token, you may suffer 1 damage to discard that token."
    },
    "4-LOM": {
      text: "%SCUMONLY%%LINEBREAK%When attacking, during the \"Modify Attack Dice\" step, you may receive 1 ion token to choose 1 of the defender's focus or evade tokens.  That token cannot be spent during this attack."
    },
    "Zuckuss": {
      text: "%SCUMONLY%%LINEBREAK%When attacking, you may receive any number of stress tokens to choose an equal number of defense dice.  The defender must reroll those dice."
    },
    'Rage': {
      text: "<strong>Action:</strong> Assign 1 focus token to your ship and receive 2 stress tokens.  Until the end of the round, when attacking, you may reroll up to 3 attack dice."
    },
    "Attanni Mindlink": {
      text: "%SCUMONLY%%LINEBREAK%Each time you are assigned a focus or stress token, each other friendly ship with Attanni Mindlink must also be assigned the same type of token if it does not already have one."
    },
    "Boba Fett": {
      text: "%SCUMONLY%%LINEBREAK%After performing an attack, if the defender was dealt a faceup Damage card, you may discard this card to choose and discard 1 of the defender's Upgrade cards."
    },
    "Dengar": {
      text: "%SCUMONLY%%LINEBREAK%When attacking, you may reroll 1 attack die.  If the defender is a unique pilot, you may instead reroll up to 2 attack dice."
    },
    '"Gonk"': {
      text: "%SCUMONLY%%LINEBREAK%<strong>Action:</strong> Place 1 shield token on this card.%LINEBREAK%<strong>Action:</strong> Remove 1 shield token from this card to recover 1 shield (up to your shield value)."
    },
    "R5-P8": {
      text: "Once per round, after defending, you may roll 1 attack die.  On a %HIT% result, the attacker suffers 1 damage.  On a %CRIT% result, you and the attacker each suffer 1 damage."
    },
    'Thermal Detonators': {
      text: "When you reveal your maneuver dial, you may discard this card to <strong>drop</strong> 1 thermal detonator token.%LINEBREAK%This token <strong>detonates</strong> at the end of the Activation phase.%LINEBREAK%<strong>Thermal Detonator Token:</strong> When this bomb token detonates, each ship at Range 1 of the token suffers 1 damage and receives 1 stress token.  Then discard this token."
    },
    "Overclocked R4": {
      text: "During the Combat phase, when you spend a focus token, you may receive 1 stress token to assign 1 focus token to your ship."
    }
  };
  modification_translations = {
    "Shield Upgrade": {
      name: "Ulepszenie osłon",
      text: "Zwiększ wartość swoich osłon o 1."
    },
    "Advanced Cloaking Device": {
      name: "Zaawansowany system maskowania",
      text: "<span class=\"card-restriction\">Tylko TIE Phantom.</span>%LINEBREAK%Po tym jak wykonasz atak, możesz wykonać darmową akcję maskowanie.",
      ship: "TIE Phantom"
    },
    "Stealth Device": {
      name: "Urządzenie maskujące",
      text: "Zwiększ wartość swojej zwrotności o 1. Jeśli zostaniesz trafiony podczas ataku, odrzuć tę kartę."
    },
    "Engine Upgrade": {
      name: "Ulepszenie silnika",
      text: "Twój pasek rozwinięć zyskuje symbol akcji %BOOST%."
    },
    "Anti-Pursuit Lasers": {
      name: "Lasery antypościgowe",
      text: "%PL_LARGESHIPONLY%Po tym jak wrogi statek wykona manewr, który sprawi że będzie zachodzić na ciebie, rzuć 1 kością ataku. Jeśli wypadnie %HIT% lub %CRIT%, wrogi statek otrzymuje 1 uszkodzenie."
    },
    "Targeting Computer": {
      name: "Komputer celowniczy",
      text: "Twój pasek akcji zyskuje symbol akcji %TARGETLOCK%."
    },
    "Hull Upgrade": {
      name: "Ulepszenie kadłuba",
      text: "Zwiększ wartość swojego kadłuba o 1."
    },
    "Munitions Failsafe": {
      name: "Zabezpieczenie amunicji",
      text: "Kiedy atakujesz przy pomocy broni dodatkowej, która nakazuje odrzucenie karty po wykonaniu ataku, nie odrzucasz jej jeśli atak nie trafi."
    },
    "Stygium Particle Accelerator": {
      name: "Akcelerator cząsteczek stygium",
      text: "Kiedy się demaskujesz lub wykonasz akcję maskowanie, możesz wykonać darmową akcję unik."
    },
    "Combat Retrofit": {
      name: "Modyfikacja bojowa",
      text: "<span class=\"card-restriction\">Tylko GR-75.</span>%LINEBREAK%Zwiększ wartość swojego kadłuba o 2 i wartość swoich osłon o 1.",
      ship: "Transport moyen GR-75"
    },
    "B-Wing/E2": {
      text: "<span class=\"card-restriction\">Tylko B-wing.</span>%LINEBREAK%Twój pasek rozwinięć zyskuje symbol rozwinięcia %CREW%."
    },
    "Countermeasures": {
      name: "Środki profilaktyczne",
      text: "%PL_LARGESHIPONLY%%LINEBREAK%Na początku fazy walki możesz odrzucić tę kartę, aby do końca rundy zwiększyć swoją zwrotność o 1. Następnie możesz usunąć ze swojego statku 1 wrogi żeton namierzonego celu."
    },
    "Experimental Interface": {
      name: "Eksperymentalny interfejs",
      text: "Raz na rundę. Po tym jak wykonasz akcję możesz wykonać 1 darmową akcję z karty rozwinięcia z nagłówkiem <strong>Akcja:</strong>, w którą jesteś wyposażony. Następnie otrzymujesz 1 żeton stresu."
    },
    "Tactical Jammer": {
      name: "Zakłócacz taktyczny",
      text: "%PL_LARGESHIPONLY%%LINEBREAK%Twój statek może przyblokowywać wrogie ataki."
    },
    "Autothrusters": {
      name: "Autodopalacze",
      text: "Kiedy się bronisz, jeśli jesteś poza Zasięgiem 2 albo znajdujesz się poza polem rażenia atakującego, możesz zmienić 1 ze swoich pustych wyników na %EVADE%. Możesz wyposażyć swój statek w tę kartę tylko jeśli masz symbol akcji %BOOST%."
    },
    "Twin Ion Engine Mk. II": {
      text: "You may treat all bank maneuvers (%BANKLEFT% and %BANKRIGHT%) as green maneuvers."
    },
    "Maneuvering Fins": {
      text: "When you reveal a turn maneuver (%TURNLEFT% or %TURNRIGHT%), you may rotate your dial to the corresponding bank maneuver (%BANKLEFT% or %BANKRIGHT%) of the same speed."
    },
    "Ion Projector": {
      text: "%LARGESHIPONLY%%LINEBREAK%After an enemy ship executes a maneuver that causes it to overlap your ship, roll 1 attack die.  On a %HIT% or %CRIT% result, the enemy ship receives 1 ion token."
    },
    'Integrated Astromech': {
      text: '<span class="card-restriction">X-wing only.</span>%LINEBREAK%When you are dealt a Damage card, you may discard 1 of your %ASTROMECH% Upgrade cards to discard that Damage card.'
    },
    'Optimized Generators': {
      text: '%HUGESHIPONLY%%LINEBREAK%Once per round, when you assign energy to an equipped Upgrade card, gain 2 energy.'
    },
    'Automated Protocols': {
      text: '%HUGESHIPONLY%%LINEBREAK%Once per round, after you perform an action that is not a recover or reinforce action, you may spend 1 energy to perform a free recover or reinforce action.'
    },
    'Ordnance Tubes': {
      text: '%HUGESHIPONLY%%LINEBREAK%You may treat each of your %HARDPOINT% upgrade icons as a %TORPEDO% or %MISSILE% icon.%LINEBREAK%When you are instructed to discard a %TORPEDO% or %MISSILE% Upgrade card, do not discard it.'
    },
    'Long-Range Scanners': {
      text: 'You can acquire target locks on ships at Range 3 and beyond.  You cannot acquire target locks on ships at Range 1-2.  You can equip this card only if you have %TORPEDO% and %MISSILE% in your upgrade bar.'
    },
    "Guidance Chips": {
      text: "Once per round, when attacking with a %TORPEDO% or %MISSILE% secondary weapon, you may change 1 die result to a %HIT% result (or a %CRIT% result if your primary weapon value is \"3\" or higher)."
    }
  };
  title_translations = {
    "Slave I": {
      text: "<span class=\"card-restriction\">Tylko Firespray-31.</span>%LINEBREAK%Twój pasek rozwinięć zyskuje symbol %TORPEDO%."
    },
    "Millennium Falcon": {
      name: "Sokół Millenium",
      text: "<span class=\"card-restriction\">Tylko YT-1300.</span>%LINEBREAK% Twój pasek akcji zyskuje symbol akcji %EVADE%."
    },
    "Moldy Crow": {
      text: "<span class=\"card-restriction\">Tylko HWK-290.</span>%LINEBREAK%Podczas fazy końcowej nie usuwaj ze swojego statku niewykorzystanych żetonów skupienia."
    },
    "ST-321": {
      ship: "Navette de classe Lambda",
      text: "<span class=\"card-restriction\">Navette de classe <em>Lambda</em> uniquement.</span>%LINEBREAK%Quand vous verrouillez une cible, vous pouvez verrouiller n'importe quel vaisseau ennemi situé dans la zone de jeu."
    },
    "Royal Guard TIE": {
      ship: "TIE Interceptor",
      name: "TIE Imperialnego Gwardzisty",
      text: "<span class=\"card-restriction\">Tylko TIE Interceptor.</span>%LINEBREAK%Możesz dołączyć do swojego statku maksymalnie 2 różne karty Modyfikacji (zamiast 1). Nie możesz dołączyć tej karty do swojego statku, jeśli wartość umiejętności pilota wynosi \"4\" lub mniej."
    },
    "Dodonna's Pride": {
      name: "Duma Dodonny",
      ship: "Korweta CR90 (dziób)",
      text: "<span class=\"card-restriction\">Tylko sekcja dziobowa CR90.</span>%LINEBREAK%Kiedy wykonujesz akcję \"Koordynacja\", możesz wybrać 2 przyjazne statki (zamiast 1). Statki te mogą wykonać po 1 darmowej akcji."
    },
    "A-Wing Test Pilot": {
      name: "Pilot testowy A-winga",
      text: "<span class=\"card-restriction\">Tylko A-wing.</span>%LINEBREAK%Twój pasek rozwinięć zyskuje symbol rozwinięcia %ELITE%. Nie możesz wyposażyć się w 2 takie same karty rozwinięcia [elite talent]. Nie możesz wyposażyć się w tę kartę, jeśli twoja wartość umiejętności pilota wynosi \"1\" lub mniej."
    },
    "Tantive IV": {
      ship: "Korweta CR90 (dziób)",
      text: "<span class=\"card-restriction\">Tylko sekcja dziobowa CR90.</span>%LINEBREAK%Twój pasek rozwinięć sekcji dziobowej zyskuje po 1 symbolu rozwinięcia %CREW% i %TEAM%."
    },
    "Bright Hope": {
      ship: "Średni transportowiec GR-75",
      text: "<span class=\"card-restriction\">Tylko GR-75.</span>%LINEBREAK%Żetony wsparcia przypisane do twojej sekcji dziobowej dostają 2 wyniki %EVADE% (zamiast 1)."
    },
    "Quantum Storm": {
      ship: "Średni transportowiec GR-75",
      text: "<span class=\"card-restriction\">Tylko GR-75.</span>%LINEBREAK%Na początku fazy końcowej, jeśli masz nie więcej niż 1 żeton energi, otrzymujesz 1 żeton energii."
    },
    "Dutyfree": {
      ship: "Średni transportowiec GR-75",
      text: "<span class=\"card-restriction\">Tylko GR-75.</span>%LINEBREAK%Kiedy wykonujesz akcję Zakłócenie, możesz wybrać wrogi statek w Zasięgu 1-3 (zamiast Zasięgu 1-2)."
    },
    "Jaina's Light": {
      ship: "Korweta CR90 (dziób)",
      text: "<span class=\"card-restriction\">Tylko sekcja dziobowa CR90.</span>%LINEBREAK%Kiedy się bronisz, raz na atak, jeśli otrzymujesz odkrytą kartę uszkodzenia, możesz ją odrzucić i dobrać nową odkrytą kartę uszkodzenia."
    },
    "Outrider": {
      text: "<span class=\"card-restriction\">Tylko YT-2400.</span>%LINEBREAK%Dopóki jesteś wyposażony w kartę rozwinięcia [cannon], nie możesz wykonywać ataków bronią podstawową. Przy pomocy dodatkowej broni [cannon] możesz wykonywać ataki skierowane przeciwko statkom znajdujacym się poza twoim polem rażenia. "
    },
    "Dauntless": {
      ship: "Décimateur VT-49",
      text: "<span class=\"card-restriction\">Tylko Decimator VT-49.</span>%LINEBREAK%Po tym jak wykonasz manewr, który sprawi że będziesz nachodzić na inny statek, możesz wykonać 1 darmową akcję. Następnie otrzymujesz 1 żeton stresu."
    },
    "Virago": {
      text: "<span class=\"card-restriction\">Tylko StarViper.</span>%LINEBREAK%Twój pasek rozwinięć zyskuje symbole rozwinięć %SYSTEM% i %ILLICIT%. Nie możesz wyposażyć swojego statku w tę kartę jeśli wartość umiejętności twojego pilota wynosi „3” lub mniej."
    },
    '"Heavy Scyk" Interceptor (Cannon)': {
      name: 'Interceptor typu Heavy Scyk (Działo)',
      ship: "Interceptor M3-A",
      text: "<span class=\"card-restriction\">Tylko Interceptor M3-A.</span>%LINEBREAK%Twój pasek rozwinięć zyskuje jeden z symboli rozwinięć: %CANNON%, %TORPEDO% lub %MISSILE%."
    },
    '"Heavy Scyk" Interceptor (Torpedo)': {
      name: 'Interceptor typu Heavy Scyk (Torpeda)',
      ship: "Interceptor M3-A",
      text: "<span class=\"card-restriction\">Tylko Interceptor M3-A.</span>%LINEBREAK%Twój pasek rozwinięć zyskuje jeden z symboli rozwinięć: %CANNON%, %TORPEDO% lub %MISSILE%."
    },
    '"Heavy Scyk" Interceptor (Missile)': {
      name: 'Intercepteur "Scyk Lourd" (Rakieta)',
      ship: "Interceptor M3-A",
      text: "<span class=\"card-restriction\">Tylko Interceptor M3-A.</span>%LINEBREAK%Twój pasek rozwinięć zyskuje jeden z symboli rozwinięć: %CANNON%, %TORPEDO% lub %MISSILE%."
    },
    "IG-2000": {
      text: "<span class=\"card-restriction\">Tylko Aggressor.</span>%LINEBREAK%Masz zdolność pilota każdego innego przyjaznego statku z kartą ulepszenia IG-2000 (jako dodatek do swojej zdolności pilota)."
    },
    "BTL-A4 Y-Wing": {
      text: "<span class=\"card-restriction\">Tylko Y-wing.</span>%LINEBREAK%Nie możesz atakować statków znajdujących się poza twoim polem rażenia. Po wykonaniu ataku przy pomocy broni podstawowej, możesz natychmiast wykonać atak przy pomocy dodatkowej broni %TURRET%."
    },
    "Andrasta": {
      text: "<span class=\"card-restriction\">Tylko Firespray-31.</span>%LINEBREAK%Twój pasek rozwinięć zyskuje dwa symbole %BOMB%."
    },
    "TIE/x1": {
      text: "<span class=\"card-restriction\">Tylko TIE Advanced.</span>%LINEBREAK%Twój pasek rozwinięć zyskuje symbol rozwinięcia %SYSTEM%. %LINEBREAK%Koszt przypisanej do tego statku karty rozwinięcia %SYSTEM% jest obniżony o 4 punkty (do minimum 0)."
    },
    "Ghost": {
      text: "<span class=\"card-restriction\">VCX-100 only.</span>%LINEBREAK%Equip the <em>Phantom</em> title card to a friendly Attack Shuttle and dock it to this ship.%LINEBREAK%After you execute a maneuver, you may deploy it from your rear guides."
    },
    "Phantom": {
      text: "While you are docked, the <em>Ghost</em> can perform primary weapon attacks from its special firing arc, and, at the end of the Combat phase, it may perform an additional attack with an equipped %TURRET%. If it performs this attack, it cannot attack again this round."
    },
    "TIE/v1": {
      text: "<span class=\"card-restriction\">TIE Advanced Prototype only.</span>%LINEBREAK%After you acquire a target lock, you may perform a free evade action."
    },
    "Mist Hunter": {
      text: "<span class=\"card-restriction\">G-1A starfighter only.</span>%LINEBREAK%Your upgrade bar gains the %BARRELROLL% Upgrade icon.%LINEBREAK%You <strong>must</strong> equip 1 \"Tractor Beam\" Upgrade card (paying its squad point cost as normal)."
    },
    "Punishing One": {
      text: "<span class=\"card-restriction\">JumpMaster 5000 only.</span>%LINEBREAK%Increase your primary weapon value by 1."
    },
    "Assailer": {
      text: "<span class=\"card-restriction\"><em>Raider</em>-class corvette aft section only.</span>%LINEBREAK%When defending, if the targeted section has a reinforce token, you may change 1 %FOCUS% result to a %EVADE% result."
    },
    "Instigator": {
      text: "<span class=\"card-restriction\"><em>Raider</em>-class corvette aft section only.</span>%LINEBREAK%After you perform a recover action, recover 1 additional shield."
    },
    "Impetuous": {
      text: "<span class=\"card-restriction\"><em>Raider</em>-class corvette aft section only.</span>%LINEBREAK%After you perform an attack that destroys an enemy ship, you may acquire a target lock."
    },
    'TIE/x7': {
      text: '<span class="card-restriction">TIE Defender only.</span>%LINEBREAK%Your upgrade bar loses the %CANNON% and %MISSILE% upgrade icons.%LINEBREAK%After executing a 3-, 4-, or 5-speed maneuver, you may assign 1 evade token to your ship.'
    },
    'TIE/D': {
      text: '<span class="card-restriction">TIE Defender only.</span>%LINEBREAK%Once per round, after you perform an attack with a %CANNON% secondary weapon that costs 3 or fewer squad points, you may perform a primary weapon attack.'
    },
    'TIE Shuttle': {
      text: '<span class="card-restriction">TIE Bomber only.</span>%LINEBREAK%Your upgrade bar loses all %TORPEDO%, %MISSILE%, and %BOMB% upgrade icons and gains 2 %CREW% upgrade icons.  You cannot equip a %CREW% Upgrade card that costs more than 4 squad points.'
    },
    'Requiem': {
      text: '%GOZANTIONLY%%LINEBREAK%When you deploy a ship, treat its pilot skill value as "8" until the end of the round.'
    },
    'Vector': {
      text: '%GOZANTIONLY%%LINEBREAK%After you execute a maneuver, you may deploy up to 4 attached ships (instead of 2).'
    },
    'Suppressor': {
      text: '%GOZANTIONLY%%LINEBREAK%Once per round, after you acquire a target lock, you may remove 1 focus, evade, or blue target lock token from that ship.'
    }
  };
  return exportObj.setupCardData(basic_cards, pilot_translations, upgrade_translations, modification_translations, title_translations);
};

exportObj = typeof exports !== "undefined" && exports !== null ? exports : this;

if (exportObj.codeToLanguage == null) {
  exportObj.codeToLanguage = {};
}

exportObj.codeToLanguage.ru = 'Русский';

if (exportObj.translations == null) {
  exportObj.translations = {};
}

exportObj.translations['Русский'] = {
  action: {
    "Barrel Roll": "Бочка",
    "Boost": "Ускорение",
    "Evade": "Уклонение",
    "Focus": "Концентрация",
    "Target Lock": "Захват цели",
    "Recover": "Recover",
    "Reinforce": "Reinforce",
    "Jam": "Jam",
    "Coordinate": "Coordinate",
    "Cloak": "Маскировка"
  },
  slot: {
    "Astromech": "Астромех",
    "Bomb": "Бомба",
    "Cannon": "Дополнительное Орудие",
    "Crew": "Экипаж",
    "Elite": "Талант",
    "Missile": "Ракета",
    "System": "Система",
    "Torpedo": "Торпеда",
    "Turret": "Турель",
    "Cargo": "Cargo",
    "Hardpoint": "Hardpoint",
    "Team": "Team",
    "Illicit": "Нелегальный",
    "Salvaged Astromech": "захваченный Астромех"
  },
  sources: {
    "Core": "База",
    "A-Wing Expansion Pack": "Дополнение A-Wing",
    "B-Wing Expansion Pack": "Дополнение B-Wing",
    "X-Wing Expansion Pack": "Дополнение X-Wing",
    "Y-Wing Expansion Pack": "Дополнение Y-Wing",
    "Millennium Falcon Expansion Pack": "Дополнение Сокол Тысячелетия",
    "HWK-290 Expansion Pack": "Дополнение HWK-290",
    "TIE Fighter Expansion Pack": "Дополнение TIE-Fighter",
    "TIE Interceptor Expansion Pack": "Дополнение TIE-Interceptor",
    "TIE Bomber Expansion Pack": "Дополнение TIE-Bomber",
    "TIE Advanced Expansion Pack": "Дополнение TIE-Advanced",
    "Lambda-Class Shuttle Expansion Pack": "Дополнение Lambda-class Shuttle",
    "Slave I Expansion Pack": "Дополнение Sklave I",
    "Imperial Aces Expansion Pack": "Дополнение Imperial Aces",
    "Rebel Transport Expansion Pack": "Дополнение Rebel Transport",
    "Z-95 Headhunter Expansion Pack": "Дополнение Z-95-Headhunter",
    "TIE Defender Expansion Pack": "Дополнение TIE-Defender",
    "E-Wing Expansion Pack": "Дополнение E-Wing",
    "TIE Phantom Expansion Pack": "Дополнение TIE-Phantom",
    "Tantive IV Expansion Pack": "Дополнение Tantive IV",
    "Rebel Aces Expansion Pack": "Дополнение Rebel Aces",
    "YT-2400 Freighter Expansion Pack": "Дополнение YT-2400 Freighter",
    "VT-49 Decimator Expansion Pack": "Дополнение VT-49 Decimator",
    "StarViper Expansion Pack": "Дополнение StarViper",
    "M3-A Interceptor Expansion Pack": "Дополнение M3-A Interceptor",
    "IG-2000 Expansion Pack": "Дополнение IG-2000",
    "Most Wanted Expansion Pack": "Дополнение Most Wanted",
    "Imperial Raider Expansion Pack": "Дополнение Imperial Raider",
    "The Force Awakens Core Set": "The Force Awakens Core Set"
  },
  ui: {
    shipSelectorPlaceholder: "Выберите корабль",
    pilotSelectorPlaceholder: "Выберите пилота",
    upgradePlaceholder: function(translator, language, slot) {
      return "Нет " + (translator(language, 'slot', slot)) + " улучшения";
    },
    modificationPlaceholder: "Нет модификации",
    titlePlaceholder: "Нет названия",
    upgradeHeader: function(translator, language, slot) {
      return "" + (translator(language, 'slot', slot)) + " улучшения";
    },
    unreleased: "не выпущено",
    epic: "Эпик",
    limited: "ограничено"
  },
  byCSSSelector: {
    '.translate.sort-cards-by': 'Сортировать карты по',
    '.xwing-card-browser option[value="name"]': 'Имени',
    '.xwing-card-browser option[value="source"]': 'Источнику',
    '.xwing-card-browser option[value="type-by-points"]': 'Типу (Очки)',
    '.xwing-card-browser option[value="type-by-name"]': 'Типу (Имени)',
    '.xwing-card-browser .translate.select-a-card': 'Выберите карту из списка слева',
    '.xwing-card-browser .info-range td': 'Reichweite',
    '.info-well .info-ship td.info-header': 'Корабль',
    '.info-well .info-skill td.info-header': 'Мастерство',
    '.info-well .info-actions td.info-header': 'Действия',
    '.info-well .info-upgrades td.info-header': 'Улучшения',
    '.info-well .info-range td.info-header': 'Дистанция',
    '.clear-squad': 'Новый отряд',
    '.save-list': 'Сохранить',
    '.save-list-as': 'Сохранить как',
    '.delete-list': 'Удалить',
    '.backend-list-my-squads': 'Загрузить отряд',
    '.view-as-text': '<span class="hidden-phone"><i class="icon-print"></i>&nbsp;Печать\Просмотр как </span>Text',
    '.randomize': 'Случайно',
    '.randomize-options': 'Опции генератора случайности',
    '.notes-container > span': 'Squad Notes',
    '.bbcode-list': 'Скопируйте BBCode ниже и вставьте в пост на форуме.<textarea></textarea><button class="btn btn-copy">Скопируйте</button>',
    '.html-list': '<textarea></textarea><button class="btn btn-copy">Скопируйте</button>',
    '.vertical-space-checkbox': "Добавить пространство для карт повреждений\улучшений на распечатке. <input type=\"checkbox\" class=\"toggle-vertical-space\" />",
    '.color-print-checkbox': "Печать в цвете. <input type=\"checkbox\" class=\"toggle-color-print\" />",
    '.print-list': '<i class="icon-print"></i>&nbsp;Печать',
    '.do-randomize': 'Случайно!',
    '#empireTab': 'Галактическая империя',
    '#rebelTab': 'Альянс повстанцев',
    '#scumTab': 'Негодяи',
    '#browserTab': 'Список карт',
    '#aboutTab': 'О сервисе'
  },
  singular: {
    'pilots': 'Пилоты',
    'modifications': 'Модификации',
    'titles': 'Названия'
  },
  types: {
    'Pilot': 'Пилот',
    'Modification': 'Modifikation',
    'Title': 'Название'
  }
};

if (exportObj.cardLoaders == null) {
  exportObj.cardLoaders = {};
}

exportObj.cardLoaders['Русский'] = function() {
  var basic_cards, modification_translations, pilot_translations, title_translations, upgrade_translations;
  exportObj.cardLanguage = 'Русский';
  basic_cards = exportObj.basicCardData();
  exportObj.canonicalizeShipNames(basic_cards);
  exportObj.ships = basic_cards.ships;
  pilot_translations = {
    "Wedge Antilles": {
      text: "Во время атаки, уменьшите значение Мобильности защищающегося на 1 (значение не может быть меньше нуля)."
    },
    "Garven Dreis": {
      text: "После использования жетона Концентрации вы можете передать его любому другому дружественному кораблю, находящемуся на Дистанции 1-2 (вместо сброса)."
    },
    "Biggs Darklighter": {
      text: "Другие дружественные корабли на Дистанции 1 не могут быть атакованы, если целью можете быть выбраны вы."
    },
    "Luke Skywalker": {
      text: "Во время защиты вы можете заменить один из результатов %FOCUS% на результат %EVADE%"
    },
    '"Dutch" Vander': {
      text: "После захвата цели, выберите любой другой дружественный корабль на Дистанции 1-2. Выбранный корабль может немедленно получить жетон Захвата Цели."
    },
    "Horton Salm": {
      text: "Во время атаки на Дистанции 2-3 вы можете перебросить любое количество ваших кубиков, не имеющих какого-либо результата."
    },
    '"Winged Gundark"': {
      text: "Во время атаки на Дистанции 1 вы можете заменить один из ваших %HIT% результатов на %CRIT% результат."
    },
    '"Night Beast"': {
      text: "После выполнения зеленого манёвра вы можете выполнить свободное действие Концентрация."
    },
    '"Backstabber"': {
      text: "Если во время атаки вы находитесь вне сектора стрельбы обороняющегося корабля, бросайте на один кубик атаки больше."
    },
    '"Dark Curse"': {
      text: "Во время обороны, атакующие вас корабли, не могут использовать маркеры Концентрации или перебрасывать кубики атаки."
    },
    '"Mauler Mithel"': {
      text: "Когда атакуете на Дистанции 1 бросайте на один кубик атаки больше."
    },
    '"Howlrunner"': {
      text: "Когда другой дружественный корабль атакует на Дистанции 1 основным оружием, он может перебросить один кубик атаки."
    },
    "Maarek Stele": {
      text: "Когда ваша атака наносит Критическое повреждение атакуемому кораблю, вместо 1 возьмите 3 карты Повреждений. Выберете 1 из них, а остальные сбросьте."
    },
    "Darth Vader": {
      text: "Во время шага «Выполните Действие» в фазе Активации, вы можете выполнить 2 действия."
    },
    "\"Fel's Wrath\"": {
      text: "Когда количество карт Повреждений будет равно или превышать значение корпуса вашего корабля, корабль не разрушается до конца этой боевой фазы."
    },
    "Turr Phennir": {
      text: "После выполнения атаки вы можете выполнить свободное действие Бочка или Ускорение."
    },
    "Soontir Fel": {
      text: "Когда вы получаете жетон Стресса, можете так же получить жетон Концентрация для этого корабля."
    },
    "Tycho Celchu": {
      text: "Вы можете выполнять действия даже при наличии у вас жетона Стресса."
    },
    "Arvel Crynyd": {
      text: "Вы можете выбрать целью для атаки вражеский корабль, находящийся в вашем секторе стрельбы, даже если вы его касаетесь."
    },
    "Chewbacca": {
      text: "Если вы получили карту Повреждений лицом вверх, немедленно переверните эту карту лицом вниз (без применения ее свойств)."
    },
    "Lando Calrissian": {
      text: "После выполнения зелёного манёвра, выберите 1 дружественный корабль на Дистанции 1. Этот корабль может выполнить любое из действий, указанных в его карте, как свободное."
    },
    "Han Solo": {
      text: "Во время атаки вы можете перебросить все ваши кубики. Если вы выбрали это, то должно быть переброшено их максимальное возможное количество."
    },
    "Kath Scarlet": {
      text: "Во время атаки, обороняющийся получает один жетон Стресса, если хотя бы один из результатов %CRIT% был отменён."
    },
    "Boba Fett": {
      text: "Когда вы вскрываете манёвр %BANKLEFT% или %BANKRIGHT%, вы можете заменить его на другой манёвр той же скорости."
    },
    "Krassis Trelix": {
      text: "Во время атаки Дополнительным оружием, вы можете перебросить один кубик атаки."
    },
    "Ten Numb": {
      text: "Во время атаки, один из ваших результатов %CRIT% нельзя отменить кубиком защиты."
    },
    "Ibtisam": {
      text: "Во время атаки или обороны вы можете перебросить один из ваших кубиков, если у вас есть хотя бы один жетон Стресса."
    },
    "Roark Garnet": {
      text: 'После начала фазы боя, выберете любой другой дружественный корабль на Дистанции 1-3. До конца фазы, Мастерство пилота выбранного корабля считается равным 12.'
    },
    "Kyle Katarn": {
      text: "В начале фазы боя вы можете передать один из ваших жетонов Концентрации другому дружественному кораблю на Дистанции 1-3."
    },
    "Jan Ors": {
      text: "Когда другой дружественный корабль атакует на Дистанции 1-3 и у вас нет жетона Стресса, вы можете получить один жетон Стресса, чтобы позволить этому кораблю бросить один дополнительный кубик атаки."
    },
    "Captain Jonus": {
      text: "Когда другой дружественный корабль атакует на Дистанции 1, используя дополнительное оружие, он может перебросить до двух кубиков атаки."
    },
    "Major Rhymer": {
      text: "Во время атаки дополнительным оружием, вы можете увеличить или уменьшить дистанцию использования оружия на один, в пределах Дистанции 1-3."
    },
    "Captain Kagi": {
      text: "Когда вражеский корабль получает жетон Захвата цели, он должен использовать ваш корабль в качестве цели, если может."
    },
    "Colonel Jendon": {
      text: "В начале фазы боя, вы можете передать один из ваших голубых жетонов Захвата цели дружественному кораблю на Дистанции 1, если у него таковых не имеется."
    },
    "Captain Yorr": {
      text: "Вы можете получить жетон Стресса вместо любого другого дружественного корабля на Дистанции 1-2, если у вас таких жетонов два или менее."
    },
    "Lieutenant Lorrir": {
      text: "При выполнении действия Бочка вы можете получить 1 жетон Стресса и использовать шаблоны (%BANKLEFT% 1) или (%BANKRIGHT% 1) вместо (%STRAIGHT% 1)."
    },
    "Tetran Cowall": {
      text: "Когда вы вскрываете маневр %UTURN%, вы можете считать скорость этого маневра как \"1,\" \"3,\" или \"5\"."
    },
    "Kir Kanos": {
      text: "Во время атаки на Дистанции 2-3 вы можете сбросить один жетон уклонения, чтобы добавить к броску один %HIT% результат."
    },
    "Carnor Jax": {
      text: "Вражеские корабли на Дистанции 1 не могут выполнять действия Уклонения или Концентрации, и не могут сбрасывать соответствующие жетоны."
    },
    "Lieutenant Blount": {
      text: "Ваша атака считается успешной, даже если защищающийся успешно отменил все повреждения."
    },
    "Airen Cracken": {
      text: "После выполнения атаки вы можете выбрать другой дружественный корабль на Дистанции 1. Этот корабль может выполнить ."
    },
    "Colonel Vessery": {
      text: "Во время атаки, после броска ваших кубиков атаки, сразу можете получить Захват цели на защищающегося, если он уже имеет красный жетон захвата цели."
    },
    "Rexler Brath": {
      text: "После выполнения атаки, принесшей противнику как минимум одну карту Повреждения, вы можете сбросить один жетон Концентрации для переворота нанесенных карт Повреждений лицом вверх."
    },
    "Etahn A'baht": {
      text: "Когда корабль противника находится внутри вашего сектора стрельбы на Дистанции 1-3, и защищается, то атакующий может изменить один из %HIT% результатов на %CRIT% результат."
    },
    "Corran Horn": {
      text: "В начале фазы Завершения вы можете выполнить одну атаку. Вы не можете атаковать в течении следующего раунда."
    },
    '"Echo"': {
      text: "Когда вы сбрасываете режим Маскировки, вы должны использовать шаблоны (%BANKRIGHT% 2) или (%BANKLEFT% 2) вместо (%STRAIGHT% 2)."
    },
    '"Whisper"': {
      text: "После выполнения успешной атаки вы можете получить один жетон КОнцентрации на ваш корабль."
    },
    "Wes Janson": {
      text: "После выполнения атаки вы можете удалить один жетон Концентрации, Уклонения или голубой жетон захвата цели с защищающегося корабя."
    },
    "Jek Porkins": {
      text: "Когда вы получаете жетон стресса, вы можете удалить его и бросить один кубик атаки. На результате %HIT% получите на этот корабль карту Повреждения лицом вниз."
    },
    '"Hobbie" Klivian': {
      text: "Когда вы получаете или тратите Захват цели, вы можете удалить один жетон стресса с вашего корабля."
    },
    "Tarn Mison": {
      text: "Когда корабль противника объявил вас целью для своей атаки, вы можете получить Захват цели на этот корабль."
    },
    "Jake Farrell": {
      text: "После выполнения действия Концентрации или получения жетона Концентрации, вы можете совершить свободное действие Ускорение или Бочка."
    },
    "Gemmer Sojan": {
      text: "Пока вы находитесь на Дистанции 1 от, по крайней мере одного, корабля противника, увеличьте показатель вашей маневренности на один."
    },
    "Keyan Farlander": {
      text: "Когда атакуете, вы можете удалить один жетон Стресса для замены всех ваших %FOCUS% результатов на %HIT% результаты."
    },
    "Nera Dantels": {
      text: "Вы можете выполнять атаки торпедами %TORPEDO% по кораблям противника, находящимися вне вашего сектора стрельбы."
    },
    "Dash Rendar": {
      text: "Вы можете игнорировать жетоны преград в фазе Активации и когда совершаете Действия."
    },
    '"Leebo"': {
      text: "Когда вы получаете карту Повреждения лицом вверх, вытяните одну дополнительную карту Повреждения, выберите одну для применения, вторую сбросьте."
    },
    "Eaden Vrill": {
      text: "Когда вы атакуете основным орудием корабль с жетоном Стресса, кидайте один дополнительный кубик атаки."
    },
    "Rear Admiral Chiraneau": {
      text: "При атаке на Дистанции 1-2, вы можете поменять один из ваших результатов %FOCUS% на %CRIT% результат."
    },
    "Commander Kenkirk": {
      text: "Если у вас нет щитов и есть хотя бы одна карта Повреждения, увеличьте вашу маневренность на один."
    },
    "Captain Oicunn": {
      text: "После выполнения маневра каждый вражеский корабль, с которым вы соприкасаетесь, получает одно повреждение."
    },
    "Prince Xizor": {
      text: "При защите, дружественный корабль на Дистанции 1 может получить один неотмененный результат %HIT% или %CRIT% вместо вас."
    },
    "Guri": {
      text: "В начале фазы Боя, если вы на Дистанции 1 от вражеского корабля, вы можете назначить один жетон концентрации вашему кораблю."
    },
    "Serissu": {
      text: "Когда другой дружественный корабль на Дистанции 1 защищается, он может перебросить один кубик защиты."
    },
    "Laetin A'shera": {
      text: "После того как вы выполнили защиту от вражеской атаки, если атака не попала, вы можете назначить один жетон уклонения вашему кораблю."
    },
    "IG-88A": {
      text: "После выполнения вами атаки, которая уничтожила цель, вы можете восстановить один щит."
    },
    "IG-88B": {
      text: "Единожды в раунд, после выполнения атаки, которая не попала, вы можете осуществить атаку из имеющегося дополнительного орудия %CANNON%."
    },
    "IG-88C": {
      text: "После выполнения вами действия Ускорения, вы можете совершить свободное действие Уклонения."
    },
    "IG-88D": {
      text: "Вы можете осуществлять маневры (%SLOOPLEFT% 3) или (%SLOOPRIGHT% 3) используя соответствующие шаблоны (%TURNLEFT% 3) или (%TURNRIGHT% 3) ."
    },
    "Boba Fett (Scum)": {
      text: "При атаке или защите, вы можете перебросить один ваш кубик за каждый вражеский корабль на Дистанции 1."
    },
    "Kath Scarlet (Scum)": {
      text: "При атаке корабля в вашем вспомогательном секторе стрельбы, бросайте один дополнительный кубик атаки."
    },
    "Emon Azzameen": {
      text: "При сбросе бомбы, вы можете использовать шаблоны [%TURNLEFT% 3], [%STRAIGHT% 3], или [%TURNRIGHT% 3] вместо шаблона [%STRAIGHT% 1]."
    },
    "Kavil": {
      text: "При атаке корабля вне вашего сектора обстрела бросайте один дополнительный кубик атаки."
    },
    "Drea Renthal": {
      text: "После того как вы использовали Захват цели вы можете получить один жетон Стресса для выполнения Захвата цели."
    },
    "Dace Bonearm": {
      text: "Когда вражеский корабль на Дистанции 1-3 получает как минимум один жетон Иона, и у вас нет жетонов Стресса, вы можете получить один жетон Стресса и нанести этому кораблю одно повреждение."
    },
    "Palob Godalhi": {
      text: "В начале фазы Боя, вы можете удалить один жетон %FOCUS% или %EVADE% с вражеского корабля на Дистанции 1-2 и назначить его своему кораблю."
    },
    "Torkil Mux": {
      text: "В начале фазы Активации выберите один вражеский корабль на Дистанции 1-2. До конца фазы Боя считайте Мастерство пилота этого корабля как \"0\"."
    },
    "N'Dru Suhlak": {
      text: "При атаке, если на Дистанции 1-2 нет других дружественных кораблей, бростайте один дополнительный кубик атаки."
    },
    "Kaa'To Leeachos": {
      text: "В начале фазы Боя вы можете удалить один жетон %FOCUS% или %EVADE% с другого дружественного корабля на Дистанции 1-2, и назначить его себе."
    },
    "Commander Alozen": {
      text: "В начале фазы Боя вы можете получить Захват цели на вражеский корабль на Дистанции 1."
    },
    "Raider-class Corvette (Fore)": {
      text: "Once per round, ??? perform a primary ??? attack, you may spend 2 e??? perform another primary wea???"
    },
    "Juno Eclipse": {
      text: "Когда вы открываете свой маневр, вы можете увеличить или уменьшить его скорость на единицу (до минимума в 1)."
    },
    "Zertik Strom": {
      text: "Вражеский корабль на Дистанции 1 не может использовать бонус дистанции при выполнении атаки."
    },
    "Lieutenant Colzet": {
      text: "В начале фазы Завершения вы можете использовать имеющийся Захват цели на вражеский корабль, для того чтобы перевернуть лицом вверх одну случайную из имеющихся у него карт Повреждений."
    },
    "Latts Razzi": {
      text: "Когда дружественный корабль объявляет атаку, вы можете использовать имеющийся Захват цели на защищающемся корабле для уменьшения его маневренности на единицу на время этой атаки."
    },
    "Graz the Hunter": {
      text: "При защите, если атакующий в вашем секторе обстрела, бросайте один дополнительный кубик защиты."
    },
    "Esege Tuketu": {
      text: "Когда другой дружественный корабль на Дистанции 1-2 атакует, вы можете считать ваш жетон %FOCUS% как принадлежащий ему."
    },
    '"Redline"': {
      text: "Вы можете осуществлять два захвата цели на один корабль. Когда вы осуществляете Захват цели, вы можете получить второй Захват цели  на этот корабль."
    },
    '"Deathrain"': {
      text: "При сбросе бомбы, вы можете использовать передние направляющие вашего корабля. После сброса бомбы вы можете осуществить свободное действие Бочка."
    },
    "Moralo Eval": {
      text: "Вы можете осуществлять атаки дополнительным орудием %CANNON% против кораблей в вашем дополнительном секторе обстрела."
    },
    'Gozanti-class Cruiser': {
      text: "After you execute a maneuver, you may deploy up to 2 attached ships."
    },
    '"Scourge"': {
      text: "When attacking a defender that has 1 or more Damage cards, roll 1 additional attack die."
    },
    "The Inquisitor": {
      text: "When attacking with your primary weapon at Range 2-3, treat the range of the attack as Range 1."
    },
    "Zuckuss": {
      text: "When attacking, you may roll 1 additional attack die.  If you do, the defender rolls 1 additional defense die."
    },
    "Dengar": {
      text: "Once per round after defending, if the attacker is inside your firing arc, you may perform an attack against the that ship."
    },
    "Poe Dameron": {
      text: "When attacking or defending, if you have a focus token, you may change 1 of your %FOCUS% results to a %HIT% or %EVADE% result."
    },
    '"Blue Ace"': {
      text: "When performing a boost action, you may use the (%TURNLEFT% 1) or (%TURNRIGHT% 1) template."
    },
    '"Omega Ace"': {
      text: "When attacking, you may spend a focus token and a target lock you have on the defender to change all of your results to %CRIT% results."
    },
    '"Epsilon Leader"': {
      text: "At the start of the Combat phase, remove 1 stress token from each friendly ship at Range 1."
    },
    '"Zeta Ace"': {
      text: "When performing a barrel roll you may use the (%STRAIGHT% 2) template instead of the (%STRAIGHT% 1) template."
    },
    '"Red Ace"': {
      text: 'The first time you remove a shield token from your ship each round, assign 1 evade token to your ship.'
    },
    '"Omega Leader"': {
      text: 'Enemy ships that you have locked cannot modify any dice when attacking you or defending against your attacks.'
    },
    'Hera Syndulla': {
      text: 'When you reveal a green or red maneuver, you may rotate your dial to another maneuver of the same difficulty.'
    },
    '"Youngster"': {
      text: "Friendly TIE fighters at Range 1-3 may perform the action on your equipped %ELITE% Upgrade card."
    },
    '"Wampa"': {
      text: "When attacking, you may cancel all die results.  If you cancel a %CRIT% result, deal 1 facedown Damage card to the defender."
    },
    '"Chaser"': {
      text: "When another friendly ship at Range 1 spends a focus token, assign a focus token to your ship."
    },
    'Ezra Bridger': {
      text: "When defending, if you are stressed, you may change up to 2 of your %FOCUS% results to %EVADE% results."
    },
    '"Zeta Leader"': {
      text: 'When attacking, if you are not stressed, you may receive 1 stress token to roll 1 additional die.'
    },
    '"Epsilon Ace"': {
      text: 'While you do not have any Damage cards, treat your pilot skill value as "12."'
    },
    "Kanan Jarrus": {
      text: "When an enemy ship at Range 1-2 is attacking, you may spend a focus token.  If you do, the attacker rolls 1 fewer attack die."
    },
    '"Chopper"': {
      text: "At the start of the Combat phase, each enemy ship you are touching receives 1 stress token."
    },
    'Hera Syndulla (Attack Shuttle)': {
      text: "When you reveal a green or red maneuver, you may rotate your dial to another maneuver of the same difficulty."
    },
    'Sabine Wren': {
      text: "Immediately before you reveal your maneuver, you may perform a free boost or barrel roll action."
    },
    '"Zeb" Orrelios': {
      text: 'When defending, you may cancel %CRIT% results before %HIT% results.'
    },
    'Tomax Bren': {
      text: 'Once per round, after you discard an %ELITE% Upgrade card, flip that card faceup.'
    },
    'Ello Asty': {
      text: 'While you are not stressed, you may treat your %TROLLLEFT% and %TROLLRIGHT% maneuvers as white maneuvers.'
    },
    "Valen Rudor": {
      text: "After defending, you may perform a free action."
    },
    "4-LOM": {
      text: "At the start of the End phase, you may assign 1 of your stress tokens to another ship at Range 1."
    },
    "Tel Trevura": {
      text: "The first time you would be destroyed, instead cancel any remaining damage, discard all Damage cards, and deal 4 facedown Damage cards to this ship."
    },
    "Manaroo": {
      text: "At the start of the Combat phase, you may assign all focus, evade, and target lock tokens assigned to you to another friendly ship."
    }
  };
  upgrade_translations = {
    "Ion Cannon Turret": {
      text: "<strong>Атака:</strong> Атакуйте 1 корабль (даже если он находится вне сектора обстрела).%LINEBREAK%Если попадаете по цели, атакованный корабль получает 1 Повреждение и 1 жетон Иона. Затем отмените все результаты кубиков."
    },
    "Proton Torpedoes": {
      text: "<strong>Атака (Захват цели):</strong>Потратьте жетон Захвата Цели и сбросьте эту карту для того, чтобы выполнить эту атаку. Вы можете заменить 1 из ваших %FOCUS% результатов на результат %CRIT%."
    },
    "R2 Astromech": {
      text: "Манёвры со скоростью 1 и 2 вы можете считать как зелёные манёвры."
    },
    "R2-D2": {
      text: "После выполнения зелёного манёвра вы можете восстановить 1 Щит (до максимума доступного вам)."
    },
    "R2-F2": {
      text: "<strong>Действие:</strong> Вы можете увеличить значение Маневренности на 1 до конца текущего раунда."
    },
    "R5-D8": {
      text: "<strong>Действие:</strong> Бросьте 1 кубик защиты. %LINEBREAK%В случае выпадения %EVADE% или %FOCUS% результата вы можете сбросить 1 карту из ваших не-критических Повреждений."
    },
    "R5-K6": {
      text: "После сброса жетона Захвата цели, бросьте1 кубик защиты.%LINEBREAK%В случае выпадения результата %EVADE% немедленно получите жетон Захвата цели на тот же самый корабль. Вы не можете\nпотратить его во время этой атаки."
    },
    "R5 Astromech": {
      text: "Во время фазы Завершения вы можете выбрать 1 из ваших карт Критических Повреждений с заголовком <strong>Корабль</strong>  и перевернуть её лицом вниз."
    },
    "Determination": {
      text: "Когда вы получаете карту Критического повреждения\nс заголовком <strong>Пилот</strong>, немедленно сбросьте её без выполнения её эффекта."
    },
    "Swarm Tactics": {
      text: "В начале фазы Боя выберите дружественный корабль на Дистанции 1. %LINEBREAK%До конца этой фазы пилот выбранного корабля имеет значение Мастерства пилота такое же как, и у вас."
    },
    "Squad Leader": {
      text: "<strong>Действие:</strong> Выберите один корабль на Дистанции 1-2, пилот которого имеет Мастерство ниже вашего.<br/>Выбранный корабль может немедленно выполнить 1 свободное действие."
    },
    "Expert Handling": {
      text: "<strong>Действие:</strong> Выполните свободное действие Бочка. Если у вас нет пиктограммы действия %BARRELROLL%, получите 1 жетон Стресса.%LINEBREAK%Затем вы можете удалить с вашего корабля 1 жетон Захвата цели противника."
    },
    "Marksmanship": {
      text: "<strong>Действие:</strong> Во время атаки в\nтекущем раунде вы можете поменять 1 ваш выпавший\nрезультат %FOCUS% на %CRIT%, и все остальные ваши результаты %FOCUS% на результат %HIT%."
    },
    "Concussion Missiles": {
      text: "<strong>Атака (Захват цели): </strong> Потратьте жетон\nЗахвата цели и сбросьте эту карту для того, чтобы выполнить эту атаку. %LINEBREAK%Вы можете заменить 1 выпавший пустой результат на %HIT% результат."
    },
    "Cluster Missiles": {
      text: "<strong>Атака (Захват цели): </strong> Потратьте жетон\nЗахвата Цели и сбросьте эту карту для того, чтобы выполнить эту атаку\nдважды."
    },
    "Daredevil": {
      text: "<strong>Действие: </strong>Выполните белый\n(%TURNLEFT% 1) или (%TURNRIGHT% 1) манёвр. Затем бросьте два кубика атаки, если вы не имеете действия %BOOST%. Получите\nпопадания %HIT% и %CRIT%, если таковые выпали."
    },
    "Elusiveness": {
      text: "Во время защиты, вы можете получить 1 жетон Стресса\nи выбрать 1 кубик атаки. Нападающий должен перебросить этот кубик.\nЕсли у вас есть хотя бы 1 жетон Стресса, вы не можете использовать эту\nспособность."
    },
    "Homing Missiles": {
      text: "<strong>Атака (Захват цели): </strong>Сбросьте эту карту для того, чтобы выполнить эту атаку.%LINEBREAK%Обороняющийся корабль не\nможет использовать жетон Уклонения во время этой атаки."
    },
    "Push the Limit": {
      text: "Единожды во время раунда, после выполнения\nдействия вы можете выполнить 1 из имеющихся у вас на Панели действий,\nкак свободное.%LINEBREAK%Затем получите 1 жетон Стресса."
    },
    "Deadeye": {
      text: "Вы можете считать «Атака [Захват Цели]», как «Атака [Концентрация]:»<br/> Когда правило Атаки гласит, что жетон Захвата Цели должен быть потрачен, вы можете потратить жетон Концентрации вместо этого."
    },
    "Expose": {
      text: "<strong>Действие: </strong>До конца этого раунда увеличьте величину вашего основного оружия на 1, и уменьшите на 1 показатель вашей Маневренности."
    },
    "Gunner": {
      text: "Если в результате выполнения атаки у вас нет попаданий, немедленно выполните атаку из основного оружия. Вы не можете выполнять других атак в этом раунде."
    },
    "Ion Cannon": {
      text: "<strong>Атака: </strong>Атакуйте 1 корабль. %LINEBREAK%Если попадаете по цели, атакованный корабль получает 1 Повреждение и\n1 жетон Иона. Затем отмените все результаты кубиков."
    },
    "Heavy Laser Cannon": {
      text: "<strong>Атака: </strong>Атакуйте 1 корабль. %LINEBREAK%Сразу после броска кубиков атаки вы должны заменить все ваши %CRIT% результаты, на %HIT% результаты ."
    },
    "Seismic Charges": {
      text: "После вскрытия своего маневра вы можете сбросить эту карту и <strong>выставить</strong> 1 жетон Сейсмического заряда.%LINEBREAK%Этот заряд <strong>детонирует</strong> в конце фазы активации."
    },
    "Mercenary Copilot": {
      text: "Во время атаки на Дистанции 3, вы можете заменить один из ваших %HIT% результатов на %CRIT%."
    },
    "Assault Missiles": {
      text: "<strong>Атака (Захват цели): </strong>Потратьте жетон\nЗахвата Цели и сбросьте эту карту для того, чтобы выполнить эту атаку.%LINEBREAK%Если эта атака попадёт, другие корабли на Дистанции 1 от обороняющегося получат 1 Повреждение."
    },
    "Veteran Instincts": {
      text: "Увеличьте Мастерство вашего пилота на 2."
    },
    "Proximity Mines": {
      text: "<strong>Действие:</strong> Сбросьте эту карту и <strong>выставите</strong> 1 жетон Мины.%LINEBREAK%При совершении кораблем манёвра, если его база и шаблон маневра накрывают этот жетон, мина <strong>детонирует</strong>."
    },
    "Weapons Engineer": {
      text: "Вы можете иметь 2 Захвата цели (по 1 на каждом\nиз кораблей).<br /><br />Во время получения Захвата цели вы можете отметить 2 разных корабля."
    },
    "Draw Their Fire": {
      text: "Когда любой дружественный корабль на Дистанции 1 получает попадание от атаки, вы можете принять на себя 1 не отменённый %CRIT% результат, вместо этого корабля."
    },
    "Luke Skywalker": {
      text: "%REBELONLY%%LINEBREAK%Если в результате выполнения атаки у вас нет попаданий, немедленно выполните атаку из основного оружия. Вы можете заменить 1 %FOCUS% результат на %HIT%. Вы не можете выполнять других атак в этом раунде."
    },
    "Nien Nunb": {
      text: "%REBELONLY%%LINEBREAK%Вы можете считать\nлюбые %STRAIGHT% манёвры зелёными."
    },
    "Chewbacca": {
      text: "%REBELONLY%%LINEBREAK%Когда вы получаете карту Повреждения, вы можете немедленно сбросить эту карту и восстановить 1 щит.%LINEBREAK%Затем сбросьте эту карту улучшения."
    },
    "Advanced Proton Torpedoes": {
      text: "<strong>Атака (Захват цели): </strong>Потратьте жетон Захвата цели и сбросьте эту карту для того, чтобы выполнить эту атаку.%LINEBREAK%Вы можете заменить до 3 пустых результатов на %FOCUS% результаты."
    },
    "Autoblaster": {
      text: "<strong>Атака: </strong>Атакуйте один корабль.%LINEBREAK%Ваши %HIT% результаты не могут быть отменены кубиками защиты.%LINEBREAK%Обороняющий может отменять %CRIT% результаты до %HIT% результатов."
    },
    "Fire-Control System": {
      text: "После выполнение атаки вы можете получить жетон Захвата Цели на оборонявшийся корабль"
    },
    "Blaster Turret": {
      text: "<strong>Атака (Концентрация): </strong>Потратьте 1 жетон Концентрации для выполнения этой атаки против 1 корабля противника (даже если противник находится вне вашего сектора обстрела)."
    },
    "Recon Specialist": {
      text: "При выполнении действия Концентрация добавьте ещё 1 жетон Концентрация вашему кораблю."
    },
    "Saboteur": {
      text: "<strong>Действие: </strong>Выберите один вражеский корабль на Дистанции 1 и бросьте кубик атаки. При выпадении %HIT% или %CTRIT% результата, выберите одну перевернутую карту повреждений этого корабля, положите её лицом вверх и исполните указанные в ней инструкции."
    },
    "Intelligence Agent": {
      text: "В начале фазы Активации выберите один корабль на Дистанции 1-2. Вы можете посмотреть на выбранный этим кораблём манёвр."
    },
    "Proton Bombs": {
      text: "После вскрытия своего маневра вы можете сбросить эту карту чтобы <strong>выставить</strong> 1 жетон Протонной бомбы. %LINEBREAK%Этот заряд <strong>детонирует</strong> в конце фазы Активации."
    },
    "Adrenaline Rush": {
      text: "При вскрытии красного манёвра вы можете сбросить эту карту и считать данный манёвр белым до конца фазы Активации."
    },
    "Advanced Sensors": {
      text: "Непосредственно перед вскрытием вашего манёвра вы можете выполнить 1 свободное действие.%LINEBREAK%Если вы используете эту возможность, вы должны пропустить шаг «Выполнение Действия» в текущем раунде."
    },
    "Sensor Jammer": {
      text: "Во время обороны вы можете заменить 1 из %HIT% результатов атакующего на %FOCUS% результат.%LINEBREAK%Атаковавший не может перебросить этот кубик."
    },
    "Darth Vader": {
      text: "%IMPERIALONLY%%LINEBREAK%После выполнения вами атаки вражеского корабля вы можете получить 2 повреждения, чтобы вражеский корабль получил 1 критическое повреждение."
    },
    "Rebel Captive": {
      text: "%IMPERIALONLY%%LINEBREAK%Единожды за раунд, первый корабль, объявивший вас целью для атаки, немедленно получает 1 жетон Стресса."
    },
    "Flight Instructor": {
      text: "Во время обороны вы можете перебросить 1 из ваших %FOCUS% результатов. Если величина Мастерства нападающего пилота «2» или менее, вы можете перебросить 1 из ваших пустых результатов, вместо %FOCUS%."
    },
    "Navigator": {
      text: "Во время вскрытия манёвра вы можете выбрать другой манёвр такого же направления.%LINEBREAK%Красный манёвр не может быть выбран, если у вас уже есть хотя бы 1 жетон Стресса."
    },
    "Opportunist": {
      text: "Во время атаки, если защищающийся не имеет жетонов Концентрации или Уклонения, вы можете получить 1 жетон Стресса и бросить 1 дополнительный кубик атаки. %LINEBREAK%Вы не можете использовать эту способность при наличии у вас жетона Стресса."
    },
    "Comms Booster": {
      text: "<strong>Энергия:</strong> Потратьте 1 энергию и удалите все жетоны стресса на дружественном корабле на Дистанции 1-3. Затем положите 1 жетон концентрации на этот корабль."
    },
    "Slicer Tools": {
      text: "<strong>Действие:</strong> Выберите 1 или более вражеских кораблей, имеющих жетоны стресса на Дистанции 1-3. Для каждого выбранного корабля вы можете потратить 1 энергию, чтобы нанести 1 Повреждение."
    },
    "Shield Projector": {
      text: "Когда корабль противника объявляет своей целью маленький или большой корабль, вы можете потратить 3 энергии, чтобы принудить этот корабль выбрать целью ва, если это возможно."
    },
    "Ion Pulse Missiles": {
      text: "<strong>Атака (Захват цели): </strong><br/>Сбросьте эту карту для выполнения этой атаки.%LINEBREAK%Если эта атака попала, защищающийся получает 1 повреждение и 2 жетона иона. Затем все результаты кубиков отменяются."
    },
    "Wingman": {
      text: "Вначале фазы Боя удалите 1 жетон стресса с другого дружественного корабля на Дистанции 1."
    },
    "Decoy": {
      text: "В начале фазы Боя вы можете выбрать 1 дружественный корабль на Дистанции 1-2. Обменяйтесь показателями Мастерства пилота вашего и пилота выбранного корабля до конца фазы."
    },
    "Outmaneuver": {
      text: "При атаке корабля, находящегося в вашем секторе обстрела, уменьшите значение Маневренности этого корабля на 1 (до минимума 0), если вы находитесь вне его сектора обстрела."
    },
    "Predator": {
      text: "Во время атаки вы можете перебросить 1 кубик атаки. Если значение Мастерства защищающегося пилота равно ‘’2’’ или меньше, вы можете перебросить 2 кубика атаки."
    },
    "Flechette Torpedoes": {
      text: "<strong>Атака (Захват цели): </strong><br/>Потратьте жетон захвата цели и сбросьте эту карту для того, чтобы выполнить эту атаку.%LINEBREAK%После выполнения этой атаки защищающийся получает 1 жетон стресса, если значение корпуса его корабля равно 4 или меньше."
    },
    "R7 Astromech": {
      text: "Один раз за раунд во время\nзащиты, если вы имеете захват цели на нападающем, вы можете сбросить захват цели и выбрать любые или все брошенные кубики атаки. Атакующий должен перебросить выбранные кубики."
    },
    "R7-T1": {
      text: "<strong>Действие: </strong> Выберите корабль противника на Дистанции 1-2. Если вы находитесь в секторе обстрела этого корабля, вы можете получить Захват цели на этот корабль. Затем вы можете выполнить свободное действие Ускорение."
    },
    "Tactician": {
      text: "После выполнения атаки по кораблю, находящемуся в вашем секторе обстрела и на Дистанции 2, этот корабль получает 1 жетон стресса."
    },
    "R2-D2 (Crew)": {
      text: "%REBELONLY%%LINEBREAK% В конце фазы Завершения, если у вашего корабля нет щитов, вы можете восстановить один щит и кинуть кубик атаки. В случае результата %HIT% случайно выберите одну из карт повреждений, лежащих лицом вниз, и переверните. Затем выполните её инструкции."
    },
    "C-3PO": {
      text: "%REBELONLY%%LINEBREAK%Один раз за раунд, до броска 1 или более кубиков защиты, назовите количестве будущих результатов %EVADE%. Если выпало ровно столько %EVADE% результатов (до изменения результатов броска), добавьте 1 результат %EVADE%."
    },
    "Single Turbolasers": {
      text: "<strong>Атака (Энергия): </strong>%LINEBREAK%Потратьте 2 энергии этой карты, чтобы выполнить атаку. Защищающийся удваивает значение Маневренности корабля против этой атаки. Вы можете поменять 1 из ваших %FOCUS% результатов на %HIT% результат."
    },
    "Quad Laser Cannons": {
      text: "<strong>Атака (Энергия): </strong>%LINEBREAK%Потратьте 1 энергию этой карты, чтобы выполнить атаку. Если атака не принесла успеха, вы можете немедленно потратить 1 энергию этой карты, чтобы выполнить атаку снова."
    },
    "Tibanna Gas Supplies": {
      text: "<strong>Энергия:</strong> Вы можете сбросить эту карту чтобы получить 3 жетона энергии."
    },
    "Ionization Reactor": {
      text: "<strong>Энергия:</strong> Потратье 5 жетонов энергии с этой карты и сбросьте эту карту, чтобы каждый другой корабль на Дистанции 1 получил по 1 повреждению и по 1 жетону Иона."
    },
    "Engine Booster": {
      text: "До вскрытия своего диска маневров вы можете потратить 1 энергию для выполнения белого маневра (%STRAIGHT% 1). Вы не можете воспользоваться этим умением, если есть угроза наложения на другой корабль."
    },
    "R3-A2": {
      text: "При объявлении цели вашей атаки, если она находится в вашем секторе обстрела, вы можете получить 1 жетон Стресса чтобы защищающийся тоже получил 1 жетон Стресса."
    },
    "R2-D6": {
      text: "Вам доступно %ELITE% Улучшение.%LINEBREAK%Вы не можете использовать экипировать этого дроида если %ELITE% уже есть на панели Улучшений, или мастерство вашего пилота 2 или меньше."
    },
    "Enhanced Scopes": {
      text: "Во время фазы Активации, рассматривайте Мастерство вашего пилота как \"0\"."
    },
    "Chardaan Refit": {
      text: "A-WING only. %LINEBREAK%Эта карта имеет отрицательную стоимость."
    },
    "Proton Rockets": {
      text: "<strong>Атака (Концентрация): </strong>%LINEBREAK%Сбросьте эту карту для того, чтобы выполнить эту атаку. Вы можете бросить дополнительные кубики атаки в количестве, равном показателю вашей Маневренности, но не более 3."
    },
    "Kyle Katarn": {
      text: "%REBELONLY%%LINEBREAK%После удаления жетона стресса с вашего корабля, вы можете назначить ему жетон концентрации."
    },
    "Jan Ors": {
      text: "%REBELONLY%%LINEBREAK%Один раз в раунд вы можете назначить дружественному кораблю на Дистанции 1-3 жетон уклонения, вместо выполнения данным кораблем действия концентрации или получения этим кораблем жетона концентрации."
    },
    "Toryn Farr": {
      text: "%HUGESHIPONLY% %REBELONLY%%LINEBREAK%<strong>Action:</strong> Spend any amount of energy to choose that many enemy ships at Range 1-2.  Remove all focus, evade, and blue target lock tokens from those ships."
    },
    "R4-D6": {
      text: "Когда вас атаковали и есть как минимум 3 неотмененных %HIT% результата, вы можете выбрать отменить эти результаты, пока не останется 2. За каждый отмененный таким образом %HIT% получите 1 жетон стресса."
    },
    "R5-P9": {
      text: "В конце фазы Боя вы можете потратить 1 из ваших жетонов концентрации для восстановления одного щита (до максимума, доступного вам)."
    },
    "WED-15 Repair Droid": {
      text: "%HUGESHIPONLY%%LINEBREAK%<strong>Action:</strong> Spend 1 energy to discard 1 of your facedown Damage cards, or spend 3 energy to discard 1 of your faceup Damage cards."
    },
    "Carlist Rieekan": {
      text: "%HUGESHIPONLY% %REBELONLY%%LINEBREAK%At the start of the Activation phase, you may discard this card to treat each friendly ship's pilot skill value as \"12\" until the end of the phase."
    },
    "Jan Dodonna": {
      text: "%HUGESHIPONLY% %REBELONLY%%LINEBREAK%When another friendly ship at Range 1 is attacking, it may change 1 of its %HIT% results to a %CRIT%."
    },
    "Expanded Cargo Hold": {
      text: "<span class=\"card-restriction\">GR-75 only.</span>%LINEBREAK%Once per round, when you would be dealt a faceup Damage card, you may draw that card from either the fore or aft Damage deck."
    },
    "Backup Shield Generator": {
      text: "At the end of each round, you may spend 1 energy to recover 1 shield (up to your shield value)."
    },
    "EM Emitter": {
      text: "When you obstruct an attack, the defender rolls 3 additional defense dice (instead of 1)."
    },
    "Frequency Jammer": {
      text: "When you perform a jam action, choose 1 enemy ship that does not have a stress token and is at Range 1 of the jammed ship.  The chosen ship receives 1 stress token."
    },
    "Han Solo": {
      text: "%REBELONLY%%LINEBREAK%When attacking, if you have a target lock on the defender, you may spend that target lock to change all of your %FOCUS% results to %HIT% results."
    },
    "Leia Organa": {
      text: "%REBELONLY%%LINEBREAK%В начале фазы Активации вы можете сбросить эту карту, чтобы позволить всем дружественным кораблям, раскрывающим красный маневр, рассматривать этот маневр белым до конца этой фазы."
    },
    "Targeting Coordinator": {
      text: "<strong>Energy:</strong> You may spend 1 energy to choose 1 friendly ship at Range 1-2.  Acquire a target lock, then assign the blue target lock token to the chosen ship."
    },
    "Raymus Antilles": {
      text: "%HUGESHIPONLY% %REBELONLY%%LINEBREAK%At the start of the Activation phase, choose 1 enemy ship at Range 1-3.  You may look at that ship's chosen maneuver.  If the maneuver is white, assign that ship 1 stress token."
    },
    "Gunnery Team": {
      text: "Once per round, when attacking with a secondary weapon, you may spend 1 energy to change 1 of your blank results to a %HIT% result."
    },
    "Sensor Team": {
      text: "When acquiring a target lock, you may lock onto an enemy ship at Range 1-5 instead of 1-3."
    },
    "Engineering Team": {
      text: "During the Activation phase, when you reveal a %STRAIGHT% maneuver, gain 1 additional energy during the \"Gain Energy\" step."
    },
    "Lando Calrissian": {
      text: "%REBELONLY%%LINEBREAK%<strong>Действие: </strong>%LINEBREAK% Киньте два зеленых кубика. За каждый %FOCUS% результат назначьте 1 жетон Концентрации вашему кораблю. За каждый %EVADE% результат назначьте 1 жетон Уклонения вашему кораблю."
    },
    "Mara Jade": {
      text: "%IMPERIALONLY%%LINEBREAK%В конце фазы Боя каждый вражеский корабль на Дистанции 1, не имеющий жетона Стресса, получает 1 жетон Стресса."
    },
    "Fleet Officer": {
      text: "<strong>Действие: </strong>%LINEBREAK% Выберите до 2 дружественных кораблей на Дистанции 1-2, и назначьте 1 жетон Концентрации каждому из этих кораблей. Затем получите жетон Стресса."
    },
    "Lone Wolf": {
      text: "При атаке или защите, если не Дистанции 1-2 не других дружественных кораблей, вы можете перебросить один пустой результат."
    },
    "Stay On Target": {
      text: "Когда вы вскрываете маневр, вы можете изменить его на другой доступный вам маневр той же скорости.%LINEBREAK% Считайте этот маневр как красный маневр."
    },
    "Dash Rendar": {
      text: "%REBELONLY%%LINEBREAK%Вы можете атаковать находясь на препятствии."
    },
    '"Leebo"': {
      text: "%REBELONLY%%LINEBREAK%<strong>Действие: </strong>%LINEBREAK% Осуществите свободное действие Ускорение. Затем получите 1 жетон Иона."
    },
    "Ruthlessness": {
      text: "%IMPERIALONLY%%LINEBREAK%После совершения атаки, которая попала в цель, вы <strong>должны</strong> выбрать один другой корабль на Дистанции 1 от цели (кроме своего). Этот корабль получает 1 Повреждение."
    },
    "Intimidation": {
      text: "Пока вы касаетесь вражеского корабля, уменьшите его значение Маневренности на 1."
    },
    "Ysanne Isard": {
      text: "%IMPERIALONLY%%LINEBREAK%В начале фазы Боя, если у вас нет щитов и есть хотя бы одна карта Повреждения, вы можете выполнить свободное действие %EVADE%."
    },
    "Moff Jerjerrod": {
      text: "%IMPERIALONLY%%LINEBREAK%Когда вы получаете карту Повреждения лицом вверх, вы можете сбросить эту карту, или другую карту %CREW% для того, чтобы перевернуть эту карту Повреждения рубашкой вверх (без применения её свойств)."
    },
    "Ion Torpedoes": {
      text: "<strong>Атака (Захват цели): </strong>%LINEBREAK%Потратье захват цели и сбросьте эту карту чтобы выполнить эту атаку. %LINEBREAK%Если атака попала, то защищающийся и все корабли на Дистанции 1 от него получают по 1 жетону Иона."
    },
    "Bodyguard": {
      text: "%SCUMONLY%%LINEBREAK%В начале фазы боя вы можете потратить жетон концентрации для выбора дружественного корабля на Дистанции 1, с мастерством пилота выше чем у вас. Увеличьте его значение Маневренности на 1 до конца раунда."
    },
    "Calculation": {
      text: "При атаке вы можете потратить жетон Концентрации для изменения 1 значения %FOCUS% на значение %CRIT%."
    },
    "Accuracy Corrector": {
      text: "При атаке, на шаге \"Изменения кубиков атаки\" вы можете отменить все значения ваших кубиков. Затем, вы можете добавить два результата %HIT% к броску.%LINEBREAK%Ваши кубики не могут быть модифицированы снова в течении этой атаки."
    },
    "Inertial Dampeners": {
      text: "Когда вы вскрываете свой маневр, вы можете скинуть эту карту для выполнения белого маневра [0%STOP%] вместо выбранного. Затем получите 1 жетон Стресса."
    },
    "Flechette Cannon": {
      text: "<strong>Атака: </strong>Атакуйте один корабль.%LINEBREAK%Если эта атака попала, защищающийся получает 1 повреждение и, если у него нет Стресса, он также получает 1 жетон Стресса. Затем отмените <strong>все</strong> результаты кубиков."
    },
    '"Mangler" Cannon': {
      text: "<strong>Атака: </strong>Атакуйте один корабль%LINEBREAK%При атаке вы можете поменять один результат %HIT% на %CRIT%."
    },
    "Dead Man's Switch": {
      text: "Когда ваш корабль уничтожен, каждый корабль на Дистанции 1 получает 1 Повреждение."
    },
    "Feedback Array": {
      text: "В течении фазы Боя, вместо осуществления атаки вы можете получить 1 жетон Иона и 1 Повреждение для того, чтобы выбрать один вражеский корабль на Дистанции 1. Этот корабль получает 1 повреждение."
    },
    '"Hot Shot" Blaster': {
      text: "<strong>Атака: </strong>%LINEBREAK%Сбросьте эту карту для атаки одного корабля (даже если он вне вашего  сектора обстрела)."
    },
    "Greedo": {
      text: "%SCUMONLY%%LINEBREAK%Первый раз когда вы атакуете в каждом раунде, и первый раз когда вы защищаетесь в каждом раунде, первая карта Повреждения применяется рубашкой вниз."
    },
    "Salvaged Astromech": {
      text: "Когда вы получаете карту Повреждения с заголовком <strong>Корабль</strong>, вы можете немедленно сбросить эту карту (до применения её эффекта).%LINEBREAK%Затем сбросьте эту карту."
    },
    "Bomb Loadout": {
      text: "<span class=\"card-restriction\">Y-Wing only.</span>%LINEBREAK%Ваша панель улучшений содержит пиктограмму %BOMB%"
    },
    '"Genius"': {
      text: "Если вы снаряжены бомбой, которая сбрасывается при вскрытии маневра, то вы можете сбросить её <strong>после</strong> выполнения маневра."
    },
    "Unhinged Astromech": {
      text: "Вы можете считать все маневры со скоростью 3 как зеленые маневры."
    },
    "R4-B11": {
      text: "При атаке, если у вас есть захват цели на защищающегося, вы можете сбросить этот захват цели для выбора некоторых или всех кубиков защиты. Защищающийся должен перебросить выбранные кубики."
    },
    "Autoblaster Turret": {
      text: "<strong>Атака: </strong>Атакуйте один корабль (даже если он вне вашего сектора обстрела)%LINEBREAK%Ваши результаты %HIT% не могут быть отменены кубиками защиты. Защищающийся может отменить результаты %CRIT% перед результатами %HIT%."
    },
    "R4 Agromech": {
      text: "При атаке, после того как вы использовали жетон Концентрации, вы можете получить Захват цели на обороняющемся."
    },
    "K4 Security Droid": {
      text: "%SCUMONLY%%LINEBREAK%После выполнения зеленого маневра вы можете осуществить Захват цели."
    },
    "Outlaw Tech": {
      text: "%SCUMONLY%%LINEBREAK%После выполнения красного маневра вы можете получить 1 жетон Концентрации."
    },
    "Advanced Targeting Computer": {
      text: "<span class=\"card-restriction\">TIE Advanced only.</span>%LINEBREAK%При атаке из основного оружия, если у вас есть захват цели на обороняющемся, вы можете добавить 1 результат %CRIT% к вашим результатам. Если вы делаете это, то вы не можете потратить Захват цели в течении этой атаки."
    },
    "Ion Cannon Battery": {
      text: "<strong>Attack (energy):</strong> Spend 2 energy from this card to perform this attack.  If this attack hits, the defender suffers 1 critical damage and receives 1 ion token.  Then cancel <strong>all<strong> dice results."
    },
    "Emperor Palpatine": {
      text: "%IMPERIALONLY%%LINEBREAK%Once per round, you may change a friendly ship's die result to any other die result.  That die result cannot be modified again."
    },
    "Bossk": {
      text: "%SCUMONLY%%LINEBREAK%After you perform an attack that does not hit, if you are not stressed, you <strong>must</strong> receive 1 stress token. Then assign 1 focus token to your ship and acquire a target lock on the defender."
    },
    "Lightning Reflexes": {
      text: "%SMALLSHIPONLY%%LINEBREAK%After you execute a white or green maneuver on your dial, you may discard this card to rotate your ship 180&deg;.  Then receive 1 stress token <strong>after</strong> the \"Check Pilot Stress\" step."
    },
    "Twin Laser Turret": {
      text: "<strong>Attack:</strong> Perform this attack <strong>twice</strong> (even against a ship outside your firing arc).<br /><br />Each time this attack hits, the defender suffers 1 damage.  Then cancel <strong>all</strong> dice results."
    },
    "Plasma Torpedoes": {
      text: "<strong>Attack (target lock):</strong> Spend your target lock and discard this card to perform this attack.<br /><br />If this attack hits, after dealing damage, remove 1 shield token from the defender."
    },
    "Ion Bombs": {
      text: "When you reveal your maneuver dial, you may discard this card to <strong>drop</strong> 1 ion bomb token.<br /><br />This token <strong>detonates</strong> at the end of the Activation phase.<br /><br /><strong>Ion Bombs Token:</strong> When this bomb token detonates, each ship at Range 1 of the token receives 2 ion tokens.  Then discard this token."
    },
    "Conner Net": {
      text: "<strong>Action:</strong> Discard this card to <strong>drop</strong> 1 Conner Net token.<br /><br />When a ship's base or maneuver template overlaps this token, this token <strong>detonates</strong>.<br /><br /><strong>Conner Net Token:</strong> When this bomb token detonates, the ship that moved through or overlapped this token suffers 1 damage, receives 2 ion tokens, and skips its \"Perform Action\" step.  Then discard this token."
    },
    "Bombardier": {
      text: "When dropping a bomb, you may use the (%STRAIGHT% 2) template instead of the (%STRAIGHT% 1) template."
    },
    "Cluster Mines": {
      text: "<strong>Action:</strong> Discard this card to <strong>drop</strong> 3 cluster mine tokens.<br /><br />When a ship's base or maneuver template overlaps a cluster mine token, that token <strong>detonates</strong>.<br /><br /><strong>Cluster Mines Tokens:</strong> When one of these bomb tokens detonates, the ship that moved through or overlapped this token rolls 2 attack dice and suffers all damage (%HIT%) rolled.  Then discard this token."
    },
    'Crack Shot': {
      text: 'When attacking a ship inside your firing arc, you may discard this card to cancel 1 of the defender\'s %EVADE% results.'
    },
    "Advanced Homing Missiles": {
      text: "<strong>Attack (target lock):</strong> Discard this card to perform this attack.%LINEBREAK%If this attack hits, deal 1 faceup Damage card to the defender.  Then cancel <strong>all</strong> dice results."
    },
    'Agent Kallus': {
      text: '%IMPERIALONLY%%LINEBREAK%At the start of the first round, choose 1 enemy small or large ship.  When attacking or defending against that ship, you may change 1 of your %FOCUS% results to a %HIT% or %EVADE% result.'
    },
    'XX-23 S-Thread Tracers': {
      text: "<strong>Attack (focus):</strong> Discard this card to perform this attack.  If this attack hits, each friendly ship at Range 1-2 of you may acquire a target lock on the defender.  Then cancel <strong>all</strong> dice results."
    },
    "Tractor Beam": {
      text: "<strong>Attack:</strong> Attack 1 ship.%LINEBREAK%If this attack hits, the defender receives 1 tractor beam token.  Then cancel <strong>all</strong> dice results."
    },
    "Cloaking Device": {
      text: "%SMALLSHIPONLY%%LINEBREAK%<strong>Action:</strong> Perform a free cloak action.%LINEBREAK%At the end of each round, if you are cloaked, roll 1 attack die.  On a %FOCUS% result, discard this card, then decloak or discard your cloak token."
    },
    "Shield Technician": {
      text: "%HUGESHIPONLY%%LINEBREAK%When you perform a recover action, instead of spending all of your energy, you can choose any amount of energy to spend."
    },
    "Weapons Guidance": {
      text: "When attacking, you may spend a focus token to change 1 of your blank results to a %HIT% result."
    },
    "BB-8": {
      text: "When you reveal a green maneuver, you may perform a free barrel roll action."
    },
    "R5-X3": {
      text: "Before you reveal your maneuver, you may discard this card to ignore obstacles until the end of the round."
    },
    "Wired": {
      text: "When attacking or defending, if you are stressed, you may reroll 1 or more of your %FOCUS% results."
    },
    'Cool Hand': {
      text: 'When you receive a stress token, you may discard this card to assign 1 focus or evade token to your ship.'
    },
    'Juke': {
      text: '%SMALLSHIPONLY%%LINEBREAK%When attacking, if you have an evade token, you may change 1 of the defender\'s %EVADE% results into a %FOCUS% result.'
    },
    'Comm Relay': {
      text: 'You cannot have more than 1 evade token.%LINEBREAK%During the End phase, do not remove an unused evade token from your ship.'
    },
    'Dual Laser Turret': {
      text: '%GOZANTIONLY%%LINEBREAK%<strong>Attack (energy):</strong> Spend 1 energy from this card to perform this attack against 1 ship (even a ship outside your firing arc).'
    },
    'Broadcast Array': {
      text: '%GOZANTIONLY%%LINEBREAK%Your action bar gains the %JAM% action icon.'
    },
    'Rear Admiral Chiraneau': {
      text: '%HUGESHIPONLY% %IMPERIALONLY%%LINEBREAK%<strong>Action:</strong> Execute a white (%STRAIGHT% 1) maneuver.'
    },
    'Ordnance Experts': {
      text: 'Once per round, when a friendly ship at Range 1-3 performs an attack with a %TORPEDO% or %MISSILE% secondary weapon, it may change 1 of its blank results to a %HIT% result.'
    },
    'Docking Clamps': {
      text: '%GOZANTIONLY% %LIMITED%%LINEBREAK%You may attach 4 up to TIE fighters, TIE interceptors, TIE bombers, or TIE Advanced to this ship.  All attached ships must have the same ship type.'
    },
    '"Zeb" Orrelios': {
      text: "%REBELONLY%%LINEBREAK%Enemy ships inside your firing arc that you are touching are not considered to be touching you when either you or they activate during the Combat phase."
    },
    'Kanan Jarrus': {
      text: "%REBELONLY%%LINEBREAK%Once per round, after a friendly ship at Range 1-2 executes a white maneuver, you may remove 1 stress token from that ship."
    },
    'Reinforced Deflectors': {
      text: "%LARGESHIPONLY%%LINEBREAK%After you suffer 3 or more damage from an attack, recover one shield (up to your shield value)."
    },
    'Dorsal Turret': {
      text: "<strong>Attack:</strong> Attack 1 ship (even a ship outside your firing arc).%LINEBREAK%If the target of this attack is at Range 1, roll 1 additional attack die."
    },
    'Targeting Astromech': {
      text: 'After you execute a red maneuver, you may acquire a target lock.'
    },
    'Hera Syndulla': {
      text: "%REBELONLY%%LINEBREAK%You may reveal and execute red maneuvers even while you are stressed."
    },
    'Ezra Bridger': {
      text: "%REBELONLY%%LINEBREAK%When attacking, if you are stressed, you may change 1 of your %FOCUS% results to a %CRIT% result."
    },
    'Sabine Wren': {
      text: "%REBELONLY%%LINEBREAK%Your upgrade bar gains the %BOMB% upgrade icon.  Once per round, before a friendly bomb token is removed, choose 1 enemy ship at Range 1 of that token. That ship suffers 1 damage."
    },
    '"Chopper"': {
      text: "%REBELONLY%%LINEBREAK%You may perform actions even while you are stressed.%LINEBREAK%After you perform an action while you are stressed, suffer 1 damage."
    },
    'Construction Droid': {
      text: '%HUGESHIPONLY% %LIMITED%%LINEBREAK%When you perform a recover action, you may spend 1 energy to discard 1 facedown Damage card.'
    },
    'Cluster Bombs': {
      text: 'After defending, you may discard this card.  If you do, each other ship at Range 1 of the defending section rolls 2 attack dice, suffering all damage (%HIT%) and critical damage (%CRIT%) rolled.'
    },
    "Adaptability (+1)": {
      text: "<span class=\"card-restriction\">Dual card.</span>%LINEBREAK%Increase your pilot skill value by 1."
    },
    "Adaptability (-1)": {
      text: "<span class=\"card-restriction\">Dual card.</span>%LINEBREAK%Decrease your pilot skill value by 1."
    },
    "Electronic Baffle": {
      text: "When you receive a stress token or an ion token, you may suffer 1 damage to discard that token."
    },
    "4-LOM": {
      text: "%SCUMONLY%%LINEBREAK%When attacking, during the \"Modify Attack Dice\" step, you may receive 1 ion token to choose 1 of the defender's focus or evade tokens.  That token cannot be spent during this attack."
    },
    "Zuckuss": {
      text: "%SCUMONLY%%LINEBREAK%When attacking, you may receive any number of stress tokens to choose an equal number of defense dice.  The defender must reroll those dice."
    },
    'Rage': {
      text: "<strong>Action:</strong> Assign 1 focus token to your ship and receive 2 stress tokens.  Until the end of the round, when attacking, you may reroll up to 3 attack dice."
    },
    "Attanni Mindlink": {
      text: "%SCUMONLY%%LINEBREAK%Each time you are assigned a focus or stress token, each other friendly ship with Attanni Mindlink must also be assigned the same type of token if it does not already have one."
    },
    "Boba Fett": {
      text: "%SCUMONLY%%LINEBREAK%After performing an attack, if the defender was dealt a faceup Damage card, you may discard this card to choose and discard 1 of the defender's Upgrade cards."
    },
    "Dengar": {
      text: "%SCUMONLY%%LINEBREAK%When attacking, you may reroll 1 attack die.  If the defender is a unique pilot, you may instead reroll up to 2 attack dice."
    },
    '"Gonk"': {
      text: "%SCUMONLY%%LINEBREAK%<strong>Action:</strong> Place 1 shield token on this card.%LINEBREAK%<strong>Action:</strong> Remove 1 shield token from this card to recover 1 shield (up to your shield value)."
    },
    "R5-P8": {
      text: "Once per round, after defending, you may roll 1 attack die.  On a %HIT% result, the attacker suffers 1 damage.  On a %CRIT% result, you and the attacker each suffer 1 damage."
    },
    'Thermal Detonators': {
      text: "When you reveal your maneuver dial, you may discard this card to <strong>drop</strong> 1 thermal detonator token.%LINEBREAK%This token <strong>detonates</strong> at the end of the Activation phase.%LINEBREAK%<strong>Thermal Detonator Token:</strong> When this bomb token detonates, each ship at Range 1 of the token suffers 1 damage and receives 1 stress token.  Then discard this token."
    },
    "Overclocked R4": {
      text: "During the Combat phase, when you spend a focus token, you may receive 1 stress token to assign 1 focus token to your ship."
    }
  };
  modification_translations = {
    "Stealth Device": {
      text: "Ваша Маневренности увеличена на 1. Сбросьте эту карту, если вы получили попадание при атаке."
    },
    "Shield Upgrade": {
      text: "Щиты вашего корабля увеличиваются на 1."
    },
    "Engine Upgrade": {
      text: "На Панель Действий добавляется действие %BOOST%"
    },
    "Anti-Pursuit Lasers": {
      text: "%DE_LARGESHIPONLY%%LINEBREAK%После того как вражеский корабль совершит манёвр, который приводит его к столкновению с вашим, бросьте 1 кубик атаки. В случае выпадения %HIT% или %CRIT% результата вражеский корабль получает 1 повреждение."
    },
    "Targeting Computer": {
      text: "На Панель действий добавляется действие %TARGETLOCK%."
    },
    "Hull Upgrade": {
      text: "Значение корпуса вашего корабля увеличивается на 1."
    },
    "Munitions Failsafe": {
      text: "При атаке второстепенным оружием, по инструкции которого вам требуется сбросить карту для выполнения этой атаки, не сбрасывайте карту, если атака не принесла успеха."
    },
    "Stygium Particle Accelerator": {
      text: "Когда вы выполняете любое из действий Сброса Маскировки или Маскировки, вы можете получить свободное действие Уклонения."
    },
    "Advanced Cloaking Device": {
      text: "После выполнения атаки, вы можете выполнить свободное действие маскировки."
    },
    "Combat Retrofit": {
      text: "<span class=\"card-restriction\">GR-75 only.</span>%LINEBREAK%Increase your hull value by 2 and your shield value by 1."
    },
    "B-Wing/E2": {
      text: "На вашу панель Улучшений добавляется улучшение %CREW%."
    },
    "Countermeasures": {
      text: "%DE_LARGESHIPONLY%%LINEBREAK%В начале фазы Боя вы можете сбросить эту карту для увеличения Маневрености вашего корабля на 1 до конца раунда. Затем вы можете скинуть 1 вражеский захват цели со своего корабля."
    },
    "Experimental Interface": {
      text: "Единожды за раунд, после выполнения действия вы можете выполнить свободное действие c экипированной карты Улучшения с заголовком <strong>Действие</strong>. Затем получите 1 жетон Стресса."
    },
    "Tactical Jammer": {
      text: "%DE_LARGESHIPONLY%%LINEBREAK%Ваш корабль может быть влияет на вражеские атаки как препятствие."
    },
    "Autothrusters": {
      text: "При защите, если вы за пределами Дистанции 2 или вне сектора обстрела атакующего корабля, вы можете поменять один пустой результат на результат %EVADE%. Вы можете экипировать это улучшение только если корабль имеет действие %BOOST%."
    },
    "Twin Ion Engine Mk. II": {
      text: "You may treat all bank maneuvers (%BANKLEFT% and %BANKRIGHT%) as green maneuvers."
    },
    "Maneuvering Fins": {
      text: "When you reveal a turn maneuver (%TURNLEFT% or %TURNRIGHT%), you may rotate your dial to the corresponding bank maneuver (%BANKLEFT% or %BANKRIGHT%) of the same speed."
    },
    "Ion Projector": {
      text: "%LARGESHIPONLY%%LINEBREAK%After an enemy ship executes a maneuver that causes it to overlap your ship, roll 1 attack die.  On a %HIT% or %CRIT% result, the enemy ship receives 1 ion token."
    },
    'Integrated Astromech': {
      text: '<span class="card-restriction">X-wing only.</span>%LINEBREAK%When you are dealt a Damage card, you may discard 1 of your %ASTROMECH% Upgrade cards to discard that Damage card.'
    },
    'Optimized Generators': {
      text: '%HUGESHIPONLY%%LINEBREAK%Once per round, when you assign energy to an equipped Upgrade card, gain 2 energy.'
    },
    'Automated Protocols': {
      text: '%HUGESHIPONLY%%LINEBREAK%Once per round, after you perform an action that is not a recover or reinforce action, you may spend 1 energy to perform a free recover or reinforce action.'
    },
    'Ordnance Tubes': {
      text: '%HUGESHIPONLY%%LINEBREAK%You may treat each of your %HARDPOINT% upgrade icons as a %TORPEDO% or %MISSILE% icon.%LINEBREAK%When you are instructed to discard a %TORPEDO% or %MISSILE% Upgrade card, do not discard it.'
    },
    'Long-Range Scanners': {
      text: 'You can acquire target locks on ships at Range 3 and beyond.  You cannot acquire target locks on ships at Range 1-2.  You can equip this card only if you have %TORPEDO% and %MISSILE% in your upgrade bar.'
    },
    "Guidance Chips": {
      text: "Once per round, when attacking with a %TORPEDO% or %MISSILE% secondary weapon, you may change 1 die result to a %HIT% result (or a %CRIT% result if your primary weapon value is \"3\" or higher)."
    }
  };
  title_translations = {
    "Slave I": {
      text: "<span class=\"card-restriction\">Firespray-31 only.</span>%LINEBREAK%Ваша панель улучшений содержит пиктограмму %TORPEDO%."
    },
    "Millennium Falcon": {
      text: "<span class=\"card-restriction\">YT-1300 only</span>%LINEBREAK%Ваша панель Улучшений содержит пиктограмму %EVADE%"
    },
    "Moldy Crow": {
      text: "<span class=\"card-restriction\">HWK-290 only.</span>%LINEBREAK%В течении фазы Завершения не убирайте неиспользованные жетоны Концентрации с вашего корабля."
    },
    "ST-321": {
      text: "<span class=\"card-restriction\"><em>Lambda</em>-class Shuttle only.</span>%LINEBREAK%Вы можете осуществлять Захват цели на любой корабль на игровом поле."
    },
    "Royal Guard TIE": {
      text: "<span class=\"card-restriction\">TIE Interceptor only.</span>%LINEBREAK%Вы можете экипировать до двух разных Улучшений-модификации (вместо одного).%LINEBREAK%Вы не можете экипировать это улучшение если Мастерство пилота \"4\" и меньше."
    },
    "Dodonna's Pride": {
      text: "<span class=\"card-restriction\">CR90 fore section only.</span>%LINEBREAK%When you perform a coordinate action, you may choose 2 friendly ships (instead of 1).  Those ships may each perform 1 free action."
    },
    "A-Wing Test Pilot": {
      text: "<span class=\"card-restriction\">A-Wing only.</span>%LINEBREAK%Ваша панель Улучшений получает 1 пиктограмму %ELITE%.%LINEBREAK%Вы не можете экипировать 2 одинаковых Улучшения %ELITE%. Вы не можете экипировать это улучшение, если мастерство пилота \"1\" и меньше."
    },
    "Tantive IV": {
      text: "<span class=\"card-restriction\">CR90 fore section only.</span>%LINEBREAK%Your fore section upgrade bar gains 1 additional %CREW% and 1 additional %TEAM% upgrade icon."
    },
    "Bright Hope": {
      text: "<span class=\"card-restriction\">GR-75 only.</span>%LINEBREAK%A reinforce action assigned to your fore section adds 2 %EVADE% results (instead of 1)."
    },
    "Quantum Storm": {
      text: "<span class=\"card-restriction\">GR-75 only.</span>%LINEBREAK%At the start of the End phase, if you have 1 or fewer energy tokens, gain 1 energy token."
    },
    "Dutyfree": {
      text: "<span class=\"card-restriction\">GR-75 only.</span>%LINEBREAK%When performing a jam action, you may choose an enemy ship at Range 1-3 (instead of at Range 1-2)."
    },
    "Jaina's Light": {
      text: "<span class=\"card-restriction\">CR90 fore section only.</span>%LINEBREAK%When defending, once per attack, if you are dealt a faceup Damage card, you may discard it and draw another faceup Damage card."
    },
    "Outrider": {
      text: "<span class=\"card-restriction\">YT-2400 only.</span>%LINEBREAK%Пока вы снаряжены Дополнительным Орудием %CANNON% вы <strong>не можете</strong> атаковать основным орудием, и вы можете атаковать Дополнительным Орудием %CANNON% корабли вне вашего сектора обстрела."
    },
    "Dauntless": {
      text: "<span class=\"card-restriction\">VT-49 Decimator only.</span>%LINEBREAK%После выполнения маневра, который привел к перекрытию другого корабля вы можете осуществить 1 свободное действие. Затем получите 1 жетон Стресса."
    },
    "Virago": {
      text: "<span class=\"card-restriction\">StarViper only.</span>%LINEBREAK%Ваша панель Улучшений содержит пиктограммы %SYSTEM% и %ILLICIT%.%LINEBREAK%Вы не можете экипировать это улучшение, если Мастерство пилота \"3\" или ниже."
    },
    '"Heavy Scyk" Interceptor (Cannon)': {
      text: "<span class=\"card-restriction\">M3-A Interceptor only.</span>%LINEBREAK%Ваша панель Улучшений содержит пиктограмму %CANNON%, %TORPEDO%, или %MISSILE%."
    },
    '"Heavy Scyk" Interceptor (Torpedo)': {
      text: "<span class=\"card-restriction\">M3-A Interceptor only.</span>%LINEBREAK%Ваша панель Улучшений содержит пиктограмму %CANNON%, %TORPEDO%, или %MISSILE%."
    },
    '"Heavy Scyk" Interceptor (Missile)': {
      text: "<span class=\"card-restriction\">M3-A Interceptor only.</span>%LINEBREAK%Ваша панель Улучшений содержит пиктограмму %CANNON%, %TORPEDO%, или %MISSILE%."
    },
    "IG-2000": {
      text: "<span class=\"card-restriction\">Aggressor only.</span>%LINEBREAK%Вы обладаете способностью пилота каждого другого дружественного корабля с улучшением <em>IG-2000</em> (в дополнение к вашей способности пилота)."
    },
    "BTL-A4 Y-Wing": {
      text: "<span class=\"card-restriction\">Y-Wing only.</span>%LINEBREAK%Вы не можете атаковать корабли вне вашего сектора обстрела. После атаки основным оружием вы можете немедленно атаковать дополнительным орудием %TURRET%."
    },
    "Andrasta": {
      text: "<span class=\"card-restriction\">Firespray-31 only.</span>%LINEBREAK%Ваша панель Улучшений содержит две дополнительные пиктограммы %BOMB%."
    },
    "TIE/x1": {
      text: "<span class=\"card-restriction\">TIE Advanced only.</span>%LINEBREAK%Ваша панель улучшения содержит пиктограмму %SYSTEM%.%LINEBREAK%Если вы экипируете Улучшение %SYSTEM%, его стоимость уменьшается на 4 (до минимальной стоимости \"0\")."
    },
    "Ghost": {
      text: "<span class=\"card-restriction\">VCX-100 only.</span>%LINEBREAK%Equip the <em>Phantom</em> title card to a friendly Attack Shuttle and dock it to this ship.%LINEBREAK%After you execute a maneuver, you may deploy it from your rear guides."
    },
    "Phantom": {
      text: "While you are docked, the <em>Ghost</em> can perform primary weapon attacks from its special firing arc, and, at the end of the Combat phase, it may perform an additional attack with an equipped %TURRET%. If it performs this attack, it cannot attack again this round."
    },
    "TIE/v1": {
      text: "<span class=\"card-restriction\">TIE Advanced Prototype only.</span>%LINEBREAK%After you acquire a target lock, you may perform a free evade action."
    },
    "Mist Hunter": {
      text: "<span class=\"card-restriction\">G-1A starfighter only.</span>%LINEBREAK%Your upgrade bar gains the %BARRELROLL% Upgrade icon.%LINEBREAK%You <strong>must</strong> equip 1 \"Tractor Beam\" Upgrade card (paying its squad point cost as normal)."
    },
    "Punishing One": {
      text: "<span class=\"card-restriction\">JumpMaster 5000 only.</span>%LINEBREAK%Increase your primary weapon value by 1."
    },
    "Assailer": {
      text: "<span class=\"card-restriction\"><em>Raider</em>-class corvette aft section only.</span>%LINEBREAK%When defending, if the targeted section has a reinforce token, you may change 1 %FOCUS% result to a %EVADE% result."
    },
    "Instigator": {
      text: "<span class=\"card-restriction\"><em>Raider</em>-class corvette aft section only.</span>%LINEBREAK%After you perform a recover action, recover 1 additional shield."
    },
    "Impetuous": {
      text: "<span class=\"card-restriction\"><em>Raider</em>-class corvette aft section only.</span>%LINEBREAK%After you perform an attack that destroys an enemy ship, you may acquire a target lock."
    },
    'TIE/x7': {
      text: '<span class="card-restriction">TIE Defender only.</span>%LINEBREAK%Your upgrade bar loses the %CANNON% and %MISSILE% upgrade icons.%LINEBREAK%After executing a 3-, 4-, or 5-speed maneuver, you may assign 1 evade token to your ship.'
    },
    'TIE/D': {
      text: '<span class="card-restriction">TIE Defender only.</span>%LINEBREAK%Once per round, after you perform an attack with a %CANNON% secondary weapon that costs 3 or fewer squad points, you may perform a primary weapon attack.'
    },
    'TIE Shuttle': {
      text: '<span class="card-restriction">TIE Bomber only.</span>%LINEBREAK%Your upgrade bar loses all %TORPEDO%, %MISSILE%, and %BOMB% upgrade icons and gains 2 %CREW% upgrade icons.  You cannot equip a %CREW% Upgrade card that costs more than 4 squad points.'
    },
    'Requiem': {
      text: '%GOZANTIONLY%%LINEBREAK%When you deploy a ship, treat its pilot skill value as "8" until the end of the round.'
    },
    'Vector': {
      text: '%GOZANTIONLY%%LINEBREAK%After you execute a maneuver, you may deploy up to 4 attached ships (instead of 2).'
    },
    'Suppressor': {
      text: '%GOZANTIONLY%%LINEBREAK%Once per round, after you acquire a target lock, you may remove 1 focus, evade, or blue target lock token from that ship.'
    }
  };
  return exportObj.setupCardData(basic_cards, pilot_translations, upgrade_translations, modification_translations, title_translations);
};

exportObj = typeof exports !== "undefined" && exports !== null ? exports : this;

if ((_base = String.prototype).startsWith == null) {
  _base.startsWith = function(t) {
    return this.indexOf(t === 0);
  };
}

sortWithoutQuotes = function(a, b) {
  var a_name, b_name;
  a_name = a.replace(/[^a-z0-9]/ig, '');
  b_name = b.replace(/[^a-z0-9]/ig, '');
  if (a_name < b_name) {
    return -1;
  } else if (a_name > b_name) {
    return 1;
  } else {
    return 0;
  }
};

exportObj.manifestByExpansion = {
  'Core': [
    {
      name: 'X-Wing',
      type: 'ship',
      count: 1
    }, {
      name: 'TIE Fighter',
      type: 'ship',
      count: 2
    }, {
      name: 'Luke Skywalker',
      type: 'pilot',
      count: 1
    }, {
      name: 'Biggs Darklighter',
      type: 'pilot',
      count: 1
    }, {
      name: 'Red Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Rookie Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: '"Mauler Mithel"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Dark Curse"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Night Beast"',
      type: 'pilot',
      count: 1
    }, {
      name: 'Black Squadron Pilot',
      type: 'pilot',
      count: 2
    }, {
      name: 'Obsidian Squadron Pilot',
      type: 'pilot',
      count: 2
    }, {
      name: 'Academy Pilot',
      type: 'pilot',
      count: 2
    }, {
      name: 'Proton Torpedoes',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R2-F2',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R2-D2',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Determination',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Marksmanship',
      type: 'upgrade',
      count: 1
    }
  ],
  'X-Wing Expansion Pack': [
    {
      name: 'X-Wing',
      type: 'ship',
      count: 1
    }, {
      name: 'Wedge Antilles',
      type: 'pilot',
      count: 1
    }, {
      name: 'Garven Dreis',
      type: 'pilot',
      count: 1
    }, {
      name: 'Red Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Rookie Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Proton Torpedoes',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R5-K6',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R5 Astromech',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Expert Handling',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Marksmanship',
      type: 'upgrade',
      count: 1
    }
  ],
  'Y-Wing Expansion Pack': [
    {
      name: 'Y-Wing',
      type: 'ship',
      count: 1
    }, {
      name: 'Horton Salm',
      type: 'pilot',
      count: 1
    }, {
      name: '"Dutch" Vander',
      type: 'pilot',
      count: 1
    }, {
      name: 'Gray Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Gold Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Proton Torpedoes',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Ion Cannon Turret',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R5-D8',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R2 Astromech',
      type: 'upgrade',
      count: 1
    }
  ],
  'TIE Fighter Expansion Pack': [
    {
      name: 'TIE Fighter',
      type: 'ship',
      count: 1
    }, {
      name: '"Howlrunner"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Backstabber"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Winged Gundark"',
      type: 'pilot',
      count: 1
    }, {
      name: 'Black Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Obsidian Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Academy Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Determination',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Swarm Tactics',
      type: 'upgrade',
      count: 1
    }
  ],
  'TIE Advanced Expansion Pack': [
    {
      name: 'TIE Advanced',
      type: 'ship',
      count: 1
    }, {
      name: 'Darth Vader',
      type: 'pilot',
      count: 1
    }, {
      name: 'Maarek Stele',
      type: 'pilot',
      count: 1
    }, {
      name: 'Storm Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Tempest Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Concussion Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Cluster Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Squad Leader',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Swarm Tactics',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Expert Handling',
      type: 'upgrade',
      count: 1
    }
  ],
  'A-Wing Expansion Pack': [
    {
      name: 'A-Wing',
      type: 'ship',
      count: 1
    }, {
      name: 'Tycho Celchu',
      type: 'pilot',
      count: 1
    }, {
      name: 'Arvel Crynyd',
      type: 'pilot',
      count: 1
    }, {
      name: 'Green Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Prototype Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Concussion Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Homing Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Cluster Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Push the Limit',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Deadeye',
      type: 'upgrade',
      count: 1
    }
  ],
  'Millennium Falcon Expansion Pack': [
    {
      name: 'YT-1300',
      type: 'ship',
      count: 1
    }, {
      name: 'Han Solo',
      type: 'pilot',
      count: 1
    }, {
      name: 'Lando Calrissian',
      type: 'pilot',
      count: 1
    }, {
      name: 'Chewbacca',
      type: 'pilot',
      count: 1
    }, {
      name: 'Outer Rim Smuggler',
      type: 'pilot',
      count: 1
    }, {
      name: 'Concussion Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Assault Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Elusiveness',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Draw Their Fire',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Veteran Instincts',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Luke Skywalker',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Nien Nunb',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Chewbacca',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Weapons Engineer',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Shield Upgrade',
      type: 'modification',
      count: 2
    }, {
      name: 'Engine Upgrade',
      type: 'modification',
      count: 2
    }, {
      name: 'Millennium Falcon',
      type: 'title',
      count: 1
    }
  ],
  'TIE Interceptor Expansion Pack': [
    {
      name: 'TIE Interceptor',
      type: 'ship',
      count: 1
    }, {
      name: 'Soontir Fel',
      type: 'pilot',
      count: 1
    }, {
      name: 'Turr Phennir',
      type: 'pilot',
      count: 1
    }, {
      name: '"Fel\'s Wrath"',
      type: 'pilot',
      count: 1
    }, {
      name: 'Saber Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Avenger Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Alpha Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Daredevil',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Elusiveness',
      type: 'upgrade',
      count: 1
    }
  ],
  'Slave I Expansion Pack': [
    {
      name: 'Firespray-31',
      type: 'ship',
      count: 1
    }, {
      name: 'Boba Fett',
      type: 'pilot',
      count: 1
    }, {
      name: 'Kath Scarlet',
      type: 'pilot',
      count: 1
    }, {
      name: 'Krassis Trelix',
      type: 'pilot',
      count: 1
    }, {
      name: 'Bounty Hunter',
      type: 'pilot',
      count: 1
    }, {
      name: 'Homing Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Assault Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ion Cannon',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Heavy Laser Cannon',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Veteran Instincts',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Expose',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Seismic Charges',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Proximity Mines',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Gunner',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Mercenary Copilot',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Stealth Device',
      type: 'modification',
      count: 2
    }, {
      name: 'Slave I',
      type: 'title',
      count: 1
    }
  ],
  'B-Wing Expansion Pack': [
    {
      name: 'B-Wing',
      type: 'ship',
      count: 1
    }, {
      name: 'Ten Numb',
      type: 'pilot',
      count: 1
    }, {
      name: 'Ibtisam',
      type: 'pilot',
      count: 1
    }, {
      name: 'Dagger Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Blue Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Fire-Control System',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Advanced Proton Torpedoes',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Proton Torpedoes',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ion Cannon',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Autoblaster',
      type: 'upgrade',
      count: 1
    }
  ],
  "HWK-290 Expansion Pack": [
    {
      name: 'HWK-290',
      type: 'ship',
      count: 1
    }, {
      name: 'Jan Ors',
      type: 'pilot',
      count: 1
    }, {
      name: 'Kyle Katarn',
      type: 'pilot',
      count: 1
    }, {
      name: 'Roark Garnet',
      type: 'pilot',
      count: 1
    }, {
      name: 'Rebel Operative',
      type: 'pilot',
      count: 1
    }, {
      name: 'Ion Cannon Turret',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Recon Specialist',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Moldy Crow',
      type: 'title',
      count: 1
    }, {
      name: 'Blaster Turret',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Saboteur',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Intelligence Agent',
      type: 'upgrade',
      count: 1
    }
  ],
  "TIE Bomber Expansion Pack": [
    {
      name: 'TIE Bomber',
      type: 'ship',
      count: 1
    }, {
      name: 'Major Rhymer',
      type: 'pilot',
      count: 1
    }, {
      name: 'Captain Jonus',
      type: 'pilot',
      count: 1
    }, {
      name: 'Gamma Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Scimitar Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Proton Bombs',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Assault Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Advanced Proton Torpedoes',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Seismic Charges',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Adrenaline Rush',
      type: 'upgrade',
      count: 1
    }
  ],
  "Lambda-Class Shuttle Expansion Pack": [
    {
      name: 'Lambda-Class Shuttle',
      type: 'ship',
      count: 1
    }, {
      name: 'Captain Kagi',
      type: 'pilot',
      count: 1
    }, {
      name: 'Colonel Jendon',
      type: 'pilot',
      count: 1
    }, {
      name: 'Captain Yorr',
      type: 'pilot',
      count: 1
    }, {
      name: 'Omicron Group Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Sensor Jammer',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Rebel Captive',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Advanced Sensors',
      type: 'upgrade',
      count: 1
    }, {
      name: 'ST-321',
      type: 'title',
      count: 1
    }, {
      name: 'Heavy Laser Cannon',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Weapons Engineer',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Darth Vader',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Intelligence Agent',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Navigator',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Flight Instructor',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Anti-Pursuit Lasers',
      type: 'modification',
      count: 2
    }
  ],
  "Z-95 Headhunter Expansion Pack": [
    {
      name: 'Z-95 Headhunter',
      type: 'ship',
      count: 1
    }, {
      name: 'Airen Cracken',
      type: 'pilot',
      count: 1
    }, {
      name: 'Lieutenant Blount',
      type: 'pilot',
      count: 1
    }, {
      name: 'Tala Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Bandit Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Munitions Failsafe',
      type: 'modification',
      count: 1
    }, {
      name: 'Decoy',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Wingman',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ion Pulse Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Assault Missiles',
      type: 'upgrade',
      count: 1
    }
  ],
  'E-Wing Expansion Pack': [
    {
      name: 'E-Wing',
      type: 'ship',
      count: 1
    }, {
      name: 'Corran Horn',
      type: 'pilot',
      count: 1
    }, {
      name: "Etahn A'baht",
      type: 'pilot',
      count: 1
    }, {
      name: 'Blackmoon Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Knave Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Advanced Sensors',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Outmaneuver',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R7-T1',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R7 Astromech',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Flechette Torpedoes',
      type: 'upgrade',
      count: 1
    }
  ],
  'TIE Defender Expansion Pack': [
    {
      name: 'TIE Defender',
      type: 'ship',
      count: 1
    }, {
      name: 'Rexler Brath',
      type: 'pilot',
      count: 1
    }, {
      name: 'Colonel Vessery',
      type: 'pilot',
      count: 1
    }, {
      name: 'Onyx Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Delta Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Munitions Failsafe',
      type: 'modification',
      count: 1
    }, {
      name: 'Predator',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Outmaneuver',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ion Cannon',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ion Pulse Missiles',
      type: 'upgrade',
      count: 1
    }
  ],
  'TIE Phantom Expansion Pack': [
    {
      name: 'TIE Phantom',
      type: 'ship',
      count: 1
    }, {
      name: '"Whisper"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Echo"',
      type: 'pilot',
      count: 1
    }, {
      name: 'Shadow Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Sigma Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Fire-Control System',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Tactician',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Recon Specialist',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Advanced Cloaking Device',
      type: 'modification',
      count: 1
    }, {
      name: 'Stygium Particle Accelerator',
      type: 'modification',
      count: 1
    }
  ],
  'YT-2400 Freighter Expansion Pack': [
    {
      name: 'YT-2400',
      type: 'ship',
      count: 1
    }, {
      name: 'Dash Rendar',
      type: 'pilot',
      count: 1
    }, {
      name: 'Eaden Vrill',
      type: 'pilot',
      count: 1
    }, {
      name: '"Leebo"',
      type: 'pilot',
      count: 1
    }, {
      name: 'Wild Space Fringer',
      type: 'pilot',
      count: 1
    }, {
      name: 'Experimental Interface',
      type: 'modification',
      count: 1
    }, {
      name: 'Countermeasures',
      type: 'modification',
      count: 2
    }, {
      name: 'Outrider',
      type: 'title',
      count: 1
    }, {
      name: 'Lone Wolf',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Leebo"',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Lando Calrissian',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Stay On Target',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Dash Rendar',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Gunner',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Mercenary Copilot',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Proton Rockets',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Heavy Laser Cannon',
      type: 'upgrade',
      count: 1
    }
  ],
  "VT-49 Decimator Expansion Pack": [
    {
      name: 'VT-49 Decimator',
      type: 'ship',
      count: 1
    }, {
      name: 'Captain Oicunn',
      type: 'pilot',
      count: 1
    }, {
      name: 'Rear Admiral Chiraneau',
      type: 'pilot',
      count: 1
    }, {
      name: 'Commander Kenkirk',
      type: 'pilot',
      count: 1
    }, {
      name: 'Patrol Leader',
      type: 'pilot',
      count: 1
    }, {
      name: 'Ruthlessness',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Dauntless',
      type: 'title',
      count: 1
    }, {
      name: 'Ysanne Isard',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Moff Jerjerrod',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Intimidation',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Tactical Jammer',
      type: 'modification',
      count: 2
    }, {
      name: 'Proton Bombs',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Mara Jade',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Fleet Officer',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ion Torpedoes',
      type: 'upgrade',
      count: 2
    }
  ],
  'Imperial Aces Expansion Pack': [
    {
      name: 'TIE Interceptor',
      type: 'ship',
      count: 2
    }, {
      name: 'Carnor Jax',
      type: 'pilot',
      count: 1
    }, {
      name: 'Kir Kanos',
      type: 'pilot',
      count: 1
    }, {
      name: 'Royal Guard Pilot',
      type: 'pilot',
      count: 2
    }, {
      name: 'Tetran Cowall',
      type: 'pilot',
      count: 1
    }, {
      name: 'Lieutenant Lorrir',
      type: 'pilot',
      count: 1
    }, {
      name: 'Saber Squadron Pilot',
      type: 'pilot',
      count: 2
    }, {
      name: 'Royal Guard TIE',
      type: 'title',
      count: 2
    }, {
      name: 'Targeting Computer',
      type: 'modification',
      count: 2
    }, {
      name: 'Hull Upgrade',
      type: 'modification',
      count: 2
    }, {
      name: 'Push the Limit',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Opportunist',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Shield Upgrade',
      type: 'modification',
      count: 2
    }
  ],
  'Rebel Aces Expansion Pack': [
    {
      name: 'A-Wing',
      type: 'ship',
      count: 1
    }, {
      name: 'B-Wing',
      type: 'ship',
      count: 1
    }, {
      name: 'Jake Farrell',
      type: 'pilot',
      count: 1
    }, {
      name: 'Gemmer Sojan',
      type: 'pilot',
      count: 1
    }, {
      name: 'Green Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Prototype Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Keyan Farlander',
      type: 'pilot',
      count: 1
    }, {
      name: 'Nera Dantels',
      type: 'pilot',
      count: 1
    }, {
      name: 'Dagger Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Blue Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Chardaan Refit',
      type: 'upgrade',
      count: 3
    }, {
      name: 'A-Wing Test Pilot',
      type: 'title',
      count: 2
    }, {
      name: 'Enhanced Scopes',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Proton Rockets',
      type: 'upgrade',
      count: 2
    }, {
      name: 'B-Wing/E2',
      type: 'modification',
      count: 2
    }, {
      name: 'Kyle Katarn',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Jan Ors',
      type: 'upgrade',
      count: 1
    }
  ],
  'Rebel Transport Expansion Pack': [
    {
      name: 'X-Wing',
      type: 'ship',
      count: 1
    }, {
      name: 'GR-75 Medium Transport',
      type: 'ship',
      count: 1
    }, {
      name: 'GR-75 Medium Transport',
      type: 'pilot',
      count: 1
    }, {
      name: 'Wes Janson',
      type: 'pilot',
      count: 1
    }, {
      name: 'Jek Porkins',
      type: 'pilot',
      count: 1
    }, {
      name: '"Hobbie" Klivian',
      type: 'pilot',
      count: 1
    }, {
      name: 'Tarn Mison',
      type: 'pilot',
      count: 1
    }, {
      name: 'Red Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Rookie Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Dutyfree',
      type: 'title',
      count: 1
    }, {
      name: 'Quantum Storm',
      type: 'title',
      count: 1
    }, {
      name: 'Bright Hope',
      type: 'title',
      count: 1
    }, {
      name: 'Expanded Cargo Hold',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R2-D6',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R4-D6',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Flechette Torpedoes',
      type: 'upgrade',
      count: 3
    }, {
      name: 'R3-A2',
      type: 'upgrade',
      count: 1
    }, {
      name: 'WED-15 Repair Droid',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Backup Shield Generator',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Carlist Rieekan',
      type: 'upgrade',
      count: 1
    }, {
      name: 'EM Emitter',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Engine Booster',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R5-P9',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Comms Booster',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Frequency Jammer',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Shield Projector',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Tibanna Gas Supplies',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Jan Dodonna',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Toryn Farr',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Slicer Tools',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Combat Retrofit',
      type: 'modification',
      count: 1
    }
  ],
  'Tantive IV Expansion Pack': [
    {
      name: 'CR90 Corvette (Fore)',
      type: 'ship',
      count: 1
    }, {
      name: 'CR90 Corvette (Aft)',
      type: 'ship',
      count: 1
    }, {
      name: 'CR90 Corvette (Fore)',
      type: 'pilot',
      count: 1
    }, {
      name: 'CR90 Corvette (Aft)',
      type: 'pilot',
      count: 1
    }, {
      name: "Jaina's Light",
      type: 'title',
      count: 1
    }, {
      name: "Dodonna's Pride",
      type: 'title',
      count: 1
    }, {
      name: 'Tantive IV',
      type: 'title',
      count: 1
    }, {
      name: 'Backup Shield Generator',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Han Solo',
      type: 'upgrade',
      count: 1
    }, {
      name: 'C-3PO',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Engine Booster',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Comms Booster',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Engineering Team',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Gunnery Team',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ionization Reactor',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Leia Organa',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R2-D2 (Crew)',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Sensor Team',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Targeting Coordinator',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Tibanna Gas Supplies',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Raymus Antilles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Quad Laser Cannons',
      type: 'upgrade',
      count: 3
    }, {
      name: 'Single Turbolasers',
      type: 'upgrade',
      count: 3
    }
  ],
  'StarViper Expansion Pack': [
    {
      name: 'StarViper',
      type: 'ship',
      count: 1
    }, {
      name: 'Prince Xizor',
      type: 'pilot',
      count: 1
    }, {
      name: 'Guri',
      type: 'pilot',
      count: 1
    }, {
      name: 'Black Sun Vigo',
      type: 'pilot',
      count: 1
    }, {
      name: 'Black Sun Enforcer',
      type: 'pilot',
      count: 1
    }, {
      name: 'Virago',
      type: 'title',
      count: 1
    }, {
      name: 'Bodyguard',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Accuracy Corrector',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Inertial Dampeners',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Autothrusters',
      type: 'modification',
      count: 2
    }, {
      name: 'Calculation',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ion Torpedoes',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Hull Upgrade',
      type: 'modification',
      count: 1
    }
  ],
  "M3-A Interceptor Expansion Pack": [
    {
      name: 'M3-A Interceptor',
      type: 'ship',
      count: 1
    }, {
      name: 'Serissu',
      type: 'pilot',
      count: 1
    }, {
      name: "Laetin A'shera",
      type: 'pilot',
      count: 1
    }, {
      name: "Tansarii Point Veteran",
      type: 'pilot',
      count: 1
    }, {
      name: "Cartel Spacer",
      type: 'pilot',
      count: 1
    }, {
      name: '"Heavy Scyk" Interceptor',
      type: 'title',
      count: 1,
      skipForSource: true
    }, {
      name: '"Heavy Scyk" Interceptor (Cannon)',
      type: 'title',
      count: 0
    }, {
      name: '"Heavy Scyk" Interceptor (Missile)',
      type: 'title',
      count: 0
    }, {
      name: '"Heavy Scyk" Interceptor (Torpedo)',
      type: 'title',
      count: 0
    }, {
      name: 'Flechette Cannon',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ion Cannon',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Mangler" Cannon',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Stealth Device',
      type: 'modification',
      count: 1
    }
  ],
  "IG-2000 Expansion Pack": [
    {
      name: 'Aggressor',
      type: 'ship',
      count: 1
    }, {
      name: 'IG-88A',
      type: 'pilot',
      count: 1
    }, {
      name: 'IG-88B',
      type: 'pilot',
      count: 1
    }, {
      name: 'IG-88C',
      type: 'pilot',
      count: 1
    }, {
      name: 'IG-88D',
      type: 'pilot',
      count: 1
    }, {
      name: 'IG-2000',
      type: 'title',
      count: 1
    }, {
      name: 'Accuracy Corrector',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Autoblaster',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Mangler" Cannon',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Proximity Mines',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Seismic Charges',
      type: 'upgrade',
      count: 1
    }, {
      name: "Dead Man's Switch",
      type: 'upgrade',
      count: 2
    }, {
      name: 'Feedback Array',
      type: 'upgrade',
      count: 2
    }, {
      name: '"Hot Shot" Blaster',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Inertial Dampeners',
      type: 'upgrade',
      count: 1
    }
  ],
  "Most Wanted Expansion Pack": [
    {
      name: 'Z-95 Headhunter',
      type: 'ship',
      count: 2
    }, {
      name: 'Y-Wing',
      type: 'ship',
      count: 1
    }, {
      name: "N'Dru Suhlak",
      type: 'pilot',
      count: 1
    }, {
      name: "Kaa'To Leeachos",
      type: 'pilot',
      count: 1
    }, {
      name: "Black Sun Soldier",
      type: 'pilot',
      count: 2
    }, {
      name: "Binayre Pirate",
      type: 'pilot',
      count: 2
    }, {
      name: "Kavil",
      type: 'pilot',
      count: 1
    }, {
      name: "Drea Renthal",
      type: 'pilot',
      count: 1
    }, {
      name: "Hired Gun",
      type: 'pilot',
      count: 2
    }, {
      name: "Syndicate Thug",
      type: 'pilot',
      count: 2
    }, {
      name: "Boba Fett (Scum)",
      type: 'pilot',
      count: 1
    }, {
      name: "Kath Scarlet (Scum)",
      type: 'pilot',
      count: 1
    }, {
      name: "Emon Azzameen",
      type: 'pilot',
      count: 1
    }, {
      name: "Mandalorian Mercenary",
      type: 'pilot',
      count: 1
    }, {
      name: "Dace Bonearm",
      type: 'pilot',
      count: 1
    }, {
      name: "Palob Godalhi",
      type: 'pilot',
      count: 1
    }, {
      name: "Torkil Mux",
      type: 'pilot',
      count: 1
    }, {
      name: "Spice Runner",
      type: 'pilot',
      count: 1
    }, {
      name: "Greedo",
      type: 'upgrade',
      count: 1
    }, {
      name: "K4 Security Droid",
      type: 'upgrade',
      count: 1
    }, {
      name: "Outlaw Tech",
      type: 'upgrade',
      count: 1
    }, {
      name: "Autoblaster Turret",
      type: 'upgrade',
      count: 2
    }, {
      name: "Bomb Loadout",
      type: 'upgrade',
      count: 2
    }, {
      name: "R4-B11",
      type: 'upgrade',
      count: 1
    }, {
      name: '"Genius"',
      type: 'upgrade',
      count: 1
    }, {
      name: "R4 Agromech",
      type: 'upgrade',
      count: 2
    }, {
      name: "Salvaged Astromech",
      type: 'upgrade',
      count: 2
    }, {
      name: "Unhinged Astromech",
      type: 'upgrade',
      count: 2
    }, {
      name: "BTL-A4 Y-Wing",
      type: 'title',
      count: 2
    }, {
      name: "Andrasta",
      type: 'title',
      count: 1
    }, {
      name: '"Hot Shot" Blaster',
      type: 'upgrade',
      count: 1
    }
  ],
  "Hound's Tooth Expansion Pack": [
    {
      name: 'YV-666',
      type: 'ship',
      count: 1
    }, {
      name: 'Bossk',
      type: 'pilot',
      count: 1
    }, {
      name: 'Moralo Eval',
      type: 'pilot',
      count: 1
    }, {
      name: 'Latts Razzi',
      type: 'pilot',
      count: 1
    }, {
      name: 'Trandoshan Slaver',
      type: 'pilot',
      count: 1
    }, {
      name: 'Lone Wolf',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Crack Shot',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Stay On Target',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Heavy Laser Cannon',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Bossk',
      type: 'upgrade',
      count: 1
    }, {
      name: 'K4 Security Droid',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Outlaw Tech',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Glitterstim',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Engine Upgrade',
      type: 'modification',
      count: 1
    }, {
      name: 'Ion Projector',
      type: 'modification',
      count: 2
    }, {
      name: 'Maneuvering Fins',
      type: 'modification',
      count: 1
    }, {
      name: "Hound's Tooth",
      type: 'title',
      count: 1
    }
  ],
  'Kihraxz Fighter Expansion Pack': [
    {
      name: 'Kihraxz Fighter',
      type: 'ship',
      count: 1
    }, {
      name: 'Talonbane Cobra',
      type: 'pilot',
      count: 1
    }, {
      name: 'Graz the Hunter',
      type: 'pilot',
      count: 1
    }, {
      name: 'Black Sun Ace',
      type: 'pilot',
      count: 1
    }, {
      name: 'Cartel Marauder',
      type: 'pilot',
      count: 1
    }, {
      name: 'Crack Shot',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Lightning Reflexes',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Predator',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Homing Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Glitterstim',
      type: 'upgrade',
      count: 1
    }
  ],
  'K-Wing Expansion Pack': [
    {
      name: 'K-Wing',
      type: 'ship',
      count: 1
    }, {
      name: 'Miranda Doni',
      type: 'pilot',
      count: 1
    }, {
      name: 'Esege Tuketu',
      type: 'pilot',
      count: 1
    }, {
      name: 'Guardian Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Warden Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Twin Laser Turret',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Plasma Torpedoes',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Advanced Homing Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Bombardier',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Conner Net',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Extra Munitions',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ion Bombs',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Advanced SLAM',
      type: 'modification',
      count: 1
    }
  ],
  'TIE Punisher Expansion Pack': [
    {
      name: 'TIE Punisher',
      type: 'ship',
      count: 1
    }, {
      name: '"Redline"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Deathrain"',
      type: 'pilot',
      count: 1
    }, {
      name: 'Black Eight Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Cutlass Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Enhanced Scopes',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Extra Munitions',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Flechette Torpedoes',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Plasma Torpedoes',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Advanced Homing Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Cluster Mines',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ion Bombs',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Twin Ion Engine Mk. II',
      type: 'modification',
      count: 2
    }
  ],
  "Imperial Raider Expansion Pack": [
    {
      name: "Raider-class Corvette (Fore)",
      type: 'ship',
      count: 1
    }, {
      name: "Raider-class Corvette (Aft)",
      type: 'ship',
      count: 1
    }, {
      name: "TIE Advanced",
      type: 'ship',
      count: 1
    }, {
      name: "Raider-class Corvette (Fore)",
      type: 'pilot',
      count: 1
    }, {
      name: "Raider-class Corvette (Aft)",
      type: 'pilot',
      count: 1
    }, {
      name: "Juno Eclipse",
      type: 'pilot',
      count: 1
    }, {
      name: "Zertik Strom",
      type: 'pilot',
      count: 1
    }, {
      name: "Commander Alozen",
      type: 'pilot',
      count: 1
    }, {
      name: "Lieutenant Colzet",
      type: 'pilot',
      count: 1
    }, {
      name: "Storm Squadron Pilot",
      type: 'pilot',
      count: 1
    }, {
      name: "Tempest Squadron Pilot",
      type: 'pilot',
      count: 1
    }, {
      name: "Advanced Targeting Computer",
      type: 'upgrade',
      count: 4
    }, {
      name: "TIE/x1",
      type: 'title',
      count: 4
    }, {
      name: "Cluster Missiles",
      type: 'upgrade',
      count: 1
    }, {
      name: "Proton Rockets",
      type: 'upgrade',
      count: 1
    }, {
      name: "Captain Needa",
      type: 'upgrade',
      count: 1
    }, {
      name: "Grand Moff Tarkin",
      type: 'upgrade',
      count: 1
    }, {
      name: "Emperor Palpatine",
      type: 'upgrade',
      count: 1
    }, {
      name: "Admiral Ozzel",
      type: 'upgrade',
      count: 1
    }, {
      name: "Shield Technician",
      type: 'upgrade',
      count: 2
    }, {
      name: "Gunnery Team",
      type: 'upgrade',
      count: 1
    }, {
      name: "Engineering Team",
      type: 'upgrade',
      count: 1
    }, {
      name: "Sensor Team",
      type: 'upgrade',
      count: 1
    }, {
      name: "Single Turbolasers",
      type: 'upgrade',
      count: 2
    }, {
      name: "Ion Cannon Battery",
      type: 'upgrade',
      count: 4
    }, {
      name: "Quad Laser Cannons",
      type: 'upgrade',
      count: 2
    }, {
      name: "Tibanna Gas Supplies",
      type: 'upgrade',
      count: 2
    }, {
      name: "Engine Booster",
      type: 'upgrade',
      count: 1
    }, {
      name: "Backup Shield Generator",
      type: 'upgrade',
      count: 1
    }, {
      name: "Comms Booster",
      type: 'upgrade',
      count: 1
    }, {
      name: "Assailer",
      type: 'title',
      count: 1
    }, {
      name: "Instigator",
      type: 'title',
      count: 1
    }, {
      name: "Impetuous",
      type: 'title',
      count: 1
    }
  ],
  'The Force Awakens Core Set': [
    {
      name: 'T-70 X-Wing',
      type: 'ship',
      count: 1
    }, {
      name: 'TIE/fo Fighter',
      type: 'ship',
      count: 2
    }, {
      name: 'Poe Dameron',
      type: 'pilot',
      count: 1
    }, {
      name: '"Blue Ace"',
      type: 'pilot',
      count: 1
    }, {
      name: 'Red Squadron Veteran',
      type: 'pilot',
      count: 1
    }, {
      name: 'Blue Squadron Novice',
      type: 'pilot',
      count: 1
    }, {
      name: '"Omega Ace"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Epsilon Leader"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Zeta Ace"',
      type: 'pilot',
      count: 1
    }, {
      name: 'Omega Squadron Pilot',
      type: 'pilot',
      count: 2
    }, {
      name: 'Zeta Squadron Pilot',
      type: 'pilot',
      count: 2
    }, {
      name: 'Epsilon Squadron Pilot',
      type: 'pilot',
      count: 2
    }, {
      name: 'Wired',
      type: 'upgrade',
      count: 1
    }, {
      name: 'BB-8',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R5-X3',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Proton Torpedoes',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Weapons Guidance',
      type: 'upgrade',
      count: 1
    }
  ],
  'Imperial Assault Carrier Expansion Pack': [
    {
      name: 'TIE Fighter',
      type: 'ship',
      count: 2
    }, {
      name: 'Gozanti-class Cruiser',
      type: 'ship',
      count: 1
    }, {
      name: 'Gozanti-class Cruiser',
      type: 'pilot',
      count: 1
    }, {
      name: '"Scourge"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Wampa"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Youngster"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Chaser"',
      type: 'pilot',
      count: 1
    }, {
      name: 'Academy Pilot',
      type: 'pilot',
      count: 2
    }, {
      name: 'Black Squadron Pilot',
      type: 'pilot',
      count: 2
    }, {
      name: 'Obsidian Squadron Pilot',
      type: 'pilot',
      count: 2
    }, {
      name: 'Expose',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Marksmanship',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Expert Handling',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Agent Kallus',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Rear Admiral Chiraneau',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Broadcast Array',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Dual Laser Turret',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Docking Clamps',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ordnance Experts',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Automated Protocols',
      type: 'modification',
      count: 3
    }, {
      name: 'Optimized Generators',
      type: 'modification',
      count: 3
    }, {
      name: 'Ordnance Tubes',
      type: 'modification',
      count: 3
    }, {
      name: 'Requiem',
      type: 'title',
      count: 1
    }, {
      name: 'Vector',
      type: 'title',
      count: 1
    }, {
      name: 'Suppressor',
      type: 'title',
      count: 1
    }
  ],
  'T-70 X-Wing Expansion Pack': [
    {
      name: 'T-70 X-Wing',
      type: 'ship',
      count: 1
    }, {
      name: 'Ello Asty',
      type: 'pilot',
      count: 1
    }, {
      name: '"Red Ace"',
      type: 'pilot',
      count: 1
    }, {
      name: 'Red Squadron Veteran',
      type: 'pilot',
      count: 1
    }, {
      name: 'Blue Squadron Novice',
      type: 'pilot',
      count: 1
    }, {
      name: 'Cool Hand',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Targeting Astromech',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Weapons Guidance',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Integrated Astromech',
      type: 'modification',
      count: 1
    }, {
      name: 'Advanced Proton Torpedoes',
      type: 'upgrade',
      count: 1
    }
  ],
  'TIE/fo Fighter Expansion Pack': [
    {
      name: 'TIE/fo Fighter',
      type: 'ship',
      count: 1
    }, {
      name: '"Omega Leader"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Zeta Leader"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Epsilon Ace"',
      type: 'pilot',
      count: 1
    }, {
      name: 'Omega Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Zeta Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Epsilon Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Juke',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Comm Relay',
      type: 'upgrade',
      count: 1
    }
  ]
};

exportObj.Collection = (function() {
  function Collection(args) {
    this.onLanguageChange = __bind(this.onLanguageChange, this);
    var _ref, _ref1;
    this.expansions = (_ref = args.expansions) != null ? _ref : {};
    this.singletons = (_ref1 = args.singletons) != null ? _ref1 : {};
    this.backend = args.backend;
    this.setupUI();
    this.setupHandlers();
    this.reset();
    this.language = 'English';
  }

  Collection.prototype.reset = function() {
    var card, component_content, contents, count, counts, expansion, name, thing, things, type, ul, _, _base1, _base2, _base3, _base4, _base5, _base6, _i, _j, _k, _l, _len, _name, _name1, _ref, _ref1, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7, _results;
    this.shelf = {};
    this.table = {};
    _ref = this.expansions;
    for (expansion in _ref) {
      count = _ref[expansion];
      try {
        count = parseInt(count);
      } catch (_error) {
        count = 0;
      }
      for (_ = _i = 0; 0 <= count ? _i < count : _i > count; _ = 0 <= count ? ++_i : --_i) {
        _ref2 = (_ref1 = exportObj.manifestByExpansion[expansion]) != null ? _ref1 : [];
        for (_j = 0, _len = _ref2.length; _j < _len; _j++) {
          card = _ref2[_j];
          for (_ = _k = 0, _ref3 = card.count; 0 <= _ref3 ? _k < _ref3 : _k > _ref3; _ = 0 <= _ref3 ? ++_k : --_k) {
            ((_base1 = ((_base2 = this.shelf)[_name1 = card.type] != null ? _base2[_name1] : _base2[_name1] = {}))[_name = card.name] != null ? _base1[_name] : _base1[_name] = []).push(expansion);
          }
        }
      }
    }
    _ref4 = this.singletons;
    for (type in _ref4) {
      counts = _ref4[type];
      for (name in counts) {
        count = counts[name];
        for (_ = _l = 0; 0 <= count ? _l < count : _l > count; _ = 0 <= count ? ++_l : --_l) {
          ((_base3 = ((_base4 = this.shelf)[type] != null ? _base4[type] : _base4[type] = {}))[name] != null ? _base3[name] : _base3[name] = []).push('singleton');
        }
      }
    }
    this.counts = {};
    _ref5 = this.shelf;
    for (type in _ref5) {
      if (!__hasProp.call(_ref5, type)) continue;
      _ref6 = this.shelf[type];
      for (thing in _ref6) {
        if (!__hasProp.call(_ref6, thing)) continue;
        if ((_base5 = ((_base6 = this.counts)[type] != null ? _base6[type] : _base6[type] = {}))[thing] == null) {
          _base5[thing] = 0;
        }
        this.counts[type][thing] += this.shelf[type][thing].length;
      }
    }
    component_content = $(this.modal.find('.collection-inventory-content'));
    component_content.text('');
    _ref7 = this.counts;
    _results = [];
    for (type in _ref7) {
      if (!__hasProp.call(_ref7, type)) continue;
      things = _ref7[type];
      contents = component_content.append($.trim("<div class=\"row-fluid\">\n    <div class=\"span12\"><h5>" + (type.capitalize()) + "</h5></div>\n</div>\n<div class=\"row-fluid\">\n    <ul id=\"counts-" + type + "\" class=\"span12\"></ul>\n</div>"));
      ul = $(contents.find("ul#counts-" + type));
      _results.push((function() {
        var _len1, _m, _ref8, _results1;
        _ref8 = Object.keys(things).sort(sortWithoutQuotes);
        _results1 = [];
        for (_m = 0, _len1 = _ref8.length; _m < _len1; _m++) {
          thing = _ref8[_m];
          _results1.push(ul.append("<li>" + thing + " - " + things[thing] + "</li>"));
        }
        return _results1;
      })());
    }
    return _results;
  };

  Collection.prototype.fixName = function(name) {
    if (name.indexOf('"Heavy Scyk" Interceptor') === 0) {
      return '"Heavy Scyk" Interceptor';
    } else {
      return name;
    }
  };

  Collection.prototype.check = function(where, type, name) {
    var _ref, _ref1, _ref2;
    return ((_ref = ((_ref1 = ((_ref2 = where[type]) != null ? _ref2 : {})[this.fixName(name)]) != null ? _ref1 : []).length) != null ? _ref : 0) !== 0;
  };

  Collection.prototype.checkShelf = function(type, name) {
    return this.check(this.shelf, type, name);
  };

  Collection.prototype.checkTable = function(type, name) {
    return this.check(this.table, type, name);
  };

  Collection.prototype.use = function(type, name) {
    var card, e, _base1, _base2;
    name = this.fixName(name);
    try {
      card = this.shelf[type][name].pop();
    } catch (_error) {
      e = _error;
      if (card == null) {
        return false;
      }
    }
    if (card != null) {
      ((_base1 = ((_base2 = this.table)[type] != null ? _base2[type] : _base2[type] = {}))[name] != null ? _base1[name] : _base1[name] = []).push(card);
      return true;
    } else {
      return false;
    }
  };

  Collection.prototype.release = function(type, name) {
    var card, e, _base1, _base2;
    name = this.fixName(name);
    try {
      card = this.table[type][name].pop();
    } catch (_error) {
      e = _error;
      if (card == null) {
        return false;
      }
    }
    if (card != null) {
      ((_base1 = ((_base2 = this.shelf)[type] != null ? _base2[type] : _base2[type] = {}))[name] != null ? _base1[name] : _base1[name] = []).push(card);
      return true;
    } else {
      return false;
    }
  };

  Collection.prototype.save = function(cb) {
    if (cb == null) {
      cb = $.noop;
    }
    if (this.backend != null) {
      return this.backend.saveCollection(this, cb);
    }
  };

  Collection.load = function(backend, cb) {
    return backend.loadCollection(cb);
  };

  Collection.prototype.setupUI = function() {
    var collection_content, count, expansion, expname, input, item, items, modification, modificationcollection_content, name, names, pilot, pilotcollection_content, row, ship, shipcollection_content, singletonsByType, sorted_names, title, titlecollection_content, type, upgrade, upgradecollection_content, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _len5, _len6, _m, _n, _name, _o, _ref, _ref1, _ref10, _ref11, _ref12, _ref13, _ref14, _ref15, _ref16, _ref17, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8, _ref9, _results;
    singletonsByType = {};
    _ref = exportObj.manifestByExpansion;
    for (expname in _ref) {
      items = _ref[expname];
      for (_i = 0, _len = items.length; _i < _len; _i++) {
        item = items[_i];
        (singletonsByType[_name = item.type] != null ? singletonsByType[_name] : singletonsByType[_name] = {})[item.name] = true;
      }
    }
    for (type in singletonsByType) {
      names = singletonsByType[type];
      sorted_names = ((function() {
        var _results;
        _results = [];
        for (name in names) {
          _results.push(name);
        }
        return _results;
      })()).sort(sortWithoutQuotes);
      singletonsByType[type] = sorted_names;
    }
    this.modal = $(document.createElement('DIV'));
    this.modal.addClass('modal hide fade collection-modal hidden-print');
    $('body').append(this.modal);
    this.modal.append($.trim("<div class=\"modal-header\">\n    <button type=\"button\" class=\"close hidden-print\" data-dismiss=\"modal\" aria-hidden=\"true\">&times;</button>\n    <h4>Your Collection</h4>\n</div>\n<div class=\"modal-body\">\n    <ul class=\"nav nav-tabs\">\n        <li class=\"active\"><a data-target=\"#collection-expansions\" data-toggle=\"tab\">Expansions</a><li>\n        <li><a data-target=\"#collection-ships\" data-toggle=\"tab\">Ships</a><li>\n        <li><a data-target=\"#collection-pilots\" data-toggle=\"tab\">Pilots</a><li>\n        <li><a data-target=\"#collection-upgrades\" data-toggle=\"tab\">Upgrades</a><li>\n        <li><a data-target=\"#collection-modifications\" data-toggle=\"tab\">Mods</a><li>\n        <li><a data-target=\"#collection-titles\" data-toggle=\"tab\">Titles</a><li>\n        <li><a data-target=\"#collection-components\" data-toggle=\"tab\">Inventory</a><li>\n    </ul>\n    <div class=\"tab-content\">\n        <div id=\"collection-expansions\" class=\"tab-pane active container-fluid collection-content\"></div>\n        <div id=\"collection-ships\" class=\"tab-pane active container-fluid collection-ship-content\"></div>\n        <div id=\"collection-pilots\" class=\"tab-pane active container-fluid collection-pilot-content\"></div>\n        <div id=\"collection-upgrades\" class=\"tab-pane active container-fluid collection-upgrade-content\"></div>\n        <div id=\"collection-modifications\" class=\"tab-pane active container-fluid collection-modification-content\"></div>\n        <div id=\"collection-titles\" class=\"tab-pane active container-fluid collection-title-content\"></div>\n        <div id=\"collection-components\" class=\"tab-pane container-fluid collection-inventory-content\"></div>\n    </div>\n</div>\n<div class=\"modal-footer hidden-print\">\n    <span class=\"collection-status\"></span>\n    &nbsp;\n    <button class=\"btn\" data-dismiss=\"modal\" aria-hidden=\"true\">Close</button>\n</div>"));
    this.modal_status = $(this.modal.find('.collection-status'));
    collection_content = $(this.modal.find('.collection-content'));
    _ref1 = exportObj.expansions;
    for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
      expansion = _ref1[_j];
      count = parseInt((_ref2 = this.expansions[expansion]) != null ? _ref2 : 0);
      row = $.parseHTML($.trim("<div class=\"row-fluid\">\n    <div class=\"span12\">\n        <label>\n            <input class=\"expansion-count\" type=\"number\" size=\"3\" value=\"" + count + "\" />\n            <span class=\"expansion-name\">" + expansion + "</span>\n        </label>\n    </div>\n</div>"));
      input = $($(row).find('input'));
      input.data('expansion', expansion);
      input.closest('div').css('background-color', this.countToBackgroundColor(input.val()));
      $(row).find('.expansion-name').data('english_name', expansion);
      collection_content.append(row);
    }
    shipcollection_content = $(this.modal.find('.collection-ship-content'));
    _ref3 = singletonsByType.ship;
    for (_k = 0, _len2 = _ref3.length; _k < _len2; _k++) {
      ship = _ref3[_k];
      count = parseInt((_ref4 = (_ref5 = this.singletons.ship) != null ? _ref5[ship] : void 0) != null ? _ref4 : 0);
      row = $.parseHTML($.trim("<div class=\"row-fluid\">\n    <div class=\"span12\">\n        <label>\n            <input class=\"singleton-count\" type=\"number\" size=\"3\" value=\"" + count + "\" />\n            <span class=\"ship-name\">" + ship + "</span>\n        </label>\n    </div>\n</div>"));
      input = $($(row).find('input'));
      input.data('singletonType', 'ship');
      input.data('singletonName', ship);
      input.closest('div').css('background-color', this.countToBackgroundColor(input.val()));
      $(row).find('.ship-name').data('english_name', expansion);
      shipcollection_content.append(row);
    }
    pilotcollection_content = $(this.modal.find('.collection-pilot-content'));
    _ref6 = singletonsByType.pilot;
    for (_l = 0, _len3 = _ref6.length; _l < _len3; _l++) {
      pilot = _ref6[_l];
      count = parseInt((_ref7 = (_ref8 = this.singletons.pilot) != null ? _ref8[pilot] : void 0) != null ? _ref7 : 0);
      row = $.parseHTML($.trim("<div class=\"row-fluid\">\n    <div class=\"span12\">\n        <label>\n            <input class=\"singleton-count\" type=\"number\" size=\"3\" value=\"" + count + "\" />\n            <span class=\"pilot-name\">" + pilot + "</span>\n        </label>\n    </div>\n</div>"));
      input = $($(row).find('input'));
      input.data('singletonType', 'pilot');
      input.data('singletonName', pilot);
      input.closest('div').css('background-color', this.countToBackgroundColor(input.val()));
      $(row).find('.pilot-name').data('english_name', expansion);
      pilotcollection_content.append(row);
    }
    upgradecollection_content = $(this.modal.find('.collection-upgrade-content'));
    _ref9 = singletonsByType.upgrade;
    for (_m = 0, _len4 = _ref9.length; _m < _len4; _m++) {
      upgrade = _ref9[_m];
      count = parseInt((_ref10 = (_ref11 = this.singletons.upgrade) != null ? _ref11[upgrade] : void 0) != null ? _ref10 : 0);
      row = $.parseHTML($.trim("<div class=\"row-fluid\">\n    <div class=\"span12\">\n        <label>\n            <input class=\"singleton-count\" type=\"number\" size=\"3\" value=\"" + count + "\" />\n            <span class=\"upgrade-name\">" + upgrade + "</span>\n        </label>\n    </div>\n</div>"));
      input = $($(row).find('input'));
      input.data('singletonType', 'upgrade');
      input.data('singletonName', upgrade);
      input.closest('div').css('background-color', this.countToBackgroundColor(input.val()));
      $(row).find('.upgrade-name').data('english_name', expansion);
      upgradecollection_content.append(row);
    }
    modificationcollection_content = $(this.modal.find('.collection-modification-content'));
    _ref12 = singletonsByType.modification;
    for (_n = 0, _len5 = _ref12.length; _n < _len5; _n++) {
      modification = _ref12[_n];
      count = parseInt((_ref13 = (_ref14 = this.singletons.modification) != null ? _ref14[modification] : void 0) != null ? _ref13 : 0);
      row = $.parseHTML($.trim("<div class=\"row-fluid\">\n    <div class=\"span12\">\n        <label>\n            <input class=\"singleton-count\" type=\"number\" size=\"3\" value=\"" + count + "\" />\n            <span class=\"modification-name\">" + modification + "</span>\n        </label>\n    </div>\n</div>"));
      input = $($(row).find('input'));
      input.data('singletonType', 'modification');
      input.data('singletonName', modification);
      input.closest('div').css('background-color', this.countToBackgroundColor(input.val()));
      $(row).find('.modification-name').data('english_name', expansion);
      modificationcollection_content.append(row);
    }
    titlecollection_content = $(this.modal.find('.collection-title-content'));
    _ref15 = singletonsByType.title;
    _results = [];
    for (_o = 0, _len6 = _ref15.length; _o < _len6; _o++) {
      title = _ref15[_o];
      count = parseInt((_ref16 = (_ref17 = this.singletons.title) != null ? _ref17[title] : void 0) != null ? _ref16 : 0);
      row = $.parseHTML($.trim("<div class=\"row-fluid\">\n    <div class=\"span12\">\n        <label>\n            <input class=\"singleton-count\" type=\"number\" size=\"3\" value=\"" + count + "\" />\n            <span class=\"title-name\">" + title + "</span>\n        </label>\n    </div>\n</div>"));
      input = $($(row).find('input'));
      input.data('singletonType', 'title');
      input.data('singletonName', title);
      input.closest('div').css('background-color', this.countToBackgroundColor(input.val()));
      $(row).find('.title-name').data('english_name', expansion);
      _results.push(titlecollection_content.append(row));
    }
    return _results;
  };

  Collection.prototype.destroyUI = function() {
    this.modal.modal('hide');
    this.modal.remove();
    return $(exportObj).trigger('xwing-collection:destroyed', this);
  };

  Collection.prototype.setupHandlers = function() {
    $(exportObj).trigger('xwing-collection:created', this);
    $(exportObj).on('xwing-backend:authenticationChanged', (function(_this) {
      return function(e, authenticated, backend) {
        if (!authenticated) {
          return _this.destroyUI();
        }
      };
    })(this)).on('xwing-collection:saved', (function(_this) {
      return function(e, collection) {
        _this.modal_status.text('Collection saved');
        return _this.modal_status.fadeIn(100, function() {
          return _this.modal_status.fadeOut(5000);
        });
      };
    })(this)).on('xwing:languageChanged', this.onLanguageChange);
    $(this.modal.find('input.expansion-count').change((function(_this) {
      return function(e) {
        var target, val;
        target = $(e.target);
        val = target.val();
        if (val < 0 || isNaN(parseInt(val))) {
          target.val(0);
        }
        _this.expansions[target.data('expansion')] = parseInt(target.val());
        target.closest('div').css('background-color', _this.countToBackgroundColor(val));
        return $(exportObj).trigger('xwing-collection:changed', _this);
      };
    })(this)));
    return $(this.modal.find('input.singleton-count').change((function(_this) {
      return function(e) {
        var target, val, _base1, _name;
        target = $(e.target);
        val = target.val();
        if (val < 0 || isNaN(parseInt(val))) {
          target.val(0);
        }
        ((_base1 = _this.singletons)[_name = target.data('singletonType')] != null ? _base1[_name] : _base1[_name] = {})[target.data('singletonName')] = parseInt(target.val());
        target.closest('div').css('background-color', _this.countToBackgroundColor(val));
        return $(exportObj).trigger('xwing-collection:changed', _this);
      };
    })(this)));
  };

  Collection.prototype.countToBackgroundColor = function(count) {
    var i;
    count = parseInt(count);
    switch (false) {
      case count !== 0:
        return '';
      case !(count < 12):
        i = parseInt(200 * Math.pow(0.9, count - 1));
        return "rgb(" + i + ", 255, " + i + ")";
      default:
        return 'red';
    }
  };

  Collection.prototype.onLanguageChange = function(e, language) {
    if (language !== this.language) {
      (function(_this) {
        return (function(language) {
          return _this.modal.find('.expansion-name').each(function() {
            return $(this).text(exportObj.translate(language, 'sources', $(this).data('english_name')));
          });
        });
      })(this)(language);
      return this.language = language;
    }
  };

  return Collection;

})();


/*
    X-Wing Squad Builder
    Geordan Rosario <geordan@gmail.com>
    https://github.com/geordanr/xwing
 */

DFL_LANGUAGE = 'English';

builders = [];

exportObj = typeof exports !== "undefined" && exports !== null ? exports : this;

exportObj.loadCards = function(language) {
  return exportObj.cardLoaders[language]();
};

exportObj.translate = function() {
  var args, category, language, translation, what;
  language = arguments[0], category = arguments[1], what = arguments[2], args = 4 <= arguments.length ? __slice.call(arguments, 3) : [];
  translation = exportObj.translations[language][category][what];
  if (translation != null) {
    if (translation instanceof Function) {
      return translation.apply(null, [exportObj.translate, language].concat(__slice.call(args)));
    } else {
      return translation;
    }
  } else {
    return what;
  }
};

exportObj.setupTranslationSupport = function() {
  (function(builders) {
    return $(exportObj).on('xwing:languageChanged', (function(_this) {
      return function(e, language, cb) {
        var builder, html, selector, ___iced_passed_deferral, __iced_deferrals, __iced_k;
        __iced_k = __iced_k_noop;
        ___iced_passed_deferral = iced.findDeferral(arguments);
        if (cb == null) {
          cb = $.noop;
        }
        if (language in exportObj.translations) {
          $('.language-placeholder').text(language);
          (function(__iced_k) {
            var _i, _len, _ref, _results, _while;
            _ref = builders;
            _len = _ref.length;
            _i = 0;
            _while = function(__iced_k) {
              var _break, _continue, _next;
              _break = __iced_k;
              _continue = function() {
                return iced.trampoline(function() {
                  ++_i;
                  return _while(__iced_k);
                });
              };
              _next = _continue;
              if (!(_i < _len)) {
                return _break();
              } else {
                builder = _ref[_i];
                (function(__iced_k) {
                  __iced_deferrals = new iced.Deferrals(__iced_k, {
                    parent: ___iced_passed_deferral
                  });
                  builder.container.trigger('xwing:beforeLanguageLoad', __iced_deferrals.defer({
                    lineno: 16834
                  }));
                  __iced_deferrals._fulfill();
                })(_next);
              }
            };
            _while(__iced_k);
          })(function() {
            var _i, _len, _ref;
            exportObj.loadCards(language);
            _ref = exportObj.translations[language].byCSSSelector;
            for (selector in _ref) {
              if (!__hasProp.call(_ref, selector)) continue;
              html = _ref[selector];
              $(selector).html(html);
            }
            for (_i = 0, _len = builders.length; _i < _len; _i++) {
              builder = builders[_i];
              builder.container.trigger('xwing:afterLanguageLoad', language);
            }
            return __iced_k();
          });
        } else {
          return __iced_k();
        }
      };
    })(this));
  })(builders);
  exportObj.loadCards(DFL_LANGUAGE);
  return $(exportObj).trigger('xwing:languageChanged', DFL_LANGUAGE);
};

exportObj.setupTranslationUI = function(backend) {
  var language, li, _fn, _i, _len, _ref, _results;
  _ref = Object.keys(exportObj.cardLoaders).sort();
  _fn = function(language, backend) {
    return li.click(function(e) {
      if (backend != null) {
        backend.set('language', language);
      }
      return $(exportObj).trigger('xwing:languageChanged', language);
    });
  };
  _results = [];
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    language = _ref[_i];
    li = $(document.createElement('LI'));
    li.text(language);
    _fn(language, backend);
    _results.push($('ul.dropdown-menu').append(li));
  }
  return _results;
};

exportObj.registerBuilderForTranslation = function(builder) {
  if (__indexOf.call(builders, builder) < 0) {
    return builders.push(builder);
  }
};


/*
    X-Wing Squad Builder
    Geordan Rosario <geordan@gmail.com>
    https://github.com/geordanr/xwing
 */

exportObj = typeof exports !== "undefined" && exports !== null ? exports : this;

exportObj.sortHelper = function(a, b) {
  var a_name, b_name;
  if (a.points === b.points) {
    a_name = a.text.replace(/[^a-z0-9]/ig, '');
    b_name = b.text.replace(/[^a-z0-9]/ig, '');
    if (a_name === b_name) {
      return 0;
    } else {
      if (a_name > b_name) {
        return 1;
      } else {
        return -1;
      }
    }
  } else {
    if (a.points > b.points) {
      return 1;
    } else {
      return -1;
    }
  }
};

$.isMobile = function() {
  return navigator.userAgent.match(/(iPhone|iPod|iPad|Android)/i);
};

$.randomInt = function(n) {
  return Math.floor(Math.random() * n);
};

$.getParameterByName = function(name) {
  var regex, regexS, results;
  name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
  regexS = "[\\?&]" + name + "=([^&#]*)";
  regex = new RegExp(regexS);
  results = regex.exec(window.location.search);
  if (results === null) {
    return "";
  } else {
    return decodeURIComponent(results[1].replace(/\+/g, " "));
  }
};

Array.prototype.intersects = function(other) {
  var item, _i, _len;
  for (_i = 0, _len = this.length; _i < _len; _i++) {
    item = this[_i];
    if (__indexOf.call(other, item) >= 0) {
      return true;
    }
  }
  return false;
};

Array.prototype.removeItem = function(item) {
  var idx;
  idx = this.indexOf(item);
  if (idx !== -1) {
    this.splice(idx, 1);
  }
  return this;
};

String.prototype.capitalize = function() {
  return this.charAt(0).toUpperCase() + this.slice(1);
};

SQUAD_DISPLAY_NAME_MAX_LENGTH = 24;

statAndEffectiveStat = function(base_stat, effective_stats, key) {
  return "" + base_stat + (effective_stats[key] !== base_stat ? " (" + effective_stats[key] + ")" : "");
};

getPrimaryFaction = function(faction) {
  switch (faction) {
    case 'Rebel Alliance':
    case 'Resistance':
      return 'Rebel Alliance';
    case 'Galactic Empire':
    case 'First Order':
      return 'Galactic Empire';
    default:
      return faction;
  }
};

exportObj.SquadBuilder = (function() {
  var dfl_filter_func;

  function SquadBuilder(args) {
    this._makeRandomizerLoopFunc = __bind(this._makeRandomizerLoopFunc, this);
    this._randomizerLoopBody = __bind(this._randomizerLoopBody, this);
    this.releaseUnique = __bind(this.releaseUnique, this);
    this.claimUnique = __bind(this.claimUnique, this);
    this.onSquadNameChanged = __bind(this.onSquadNameChanged, this);
    this.onSquadDirtinessChanged = __bind(this.onSquadDirtinessChanged, this);
    this.onSquadLoadRequested = __bind(this.onSquadLoadRequested, this);
    this.onPointsUpdated = __bind(this.onPointsUpdated, this);
    this.onGameTypeChanged = __bind(this.onGameTypeChanged, this);
    this.onNotesUpdated = __bind(this.onNotesUpdated, this);
    this.updatePermaLink = __bind(this.updatePermaLink, this);
    this.container = $(args.container);
    this.faction = $.trim(args.faction);
    this.printable_container = $(args.printable_container);
    this.tab = $(args.tab);
    this.ships = [];
    this.uniques_in_use = {
      Pilot: [],
      Upgrade: [],
      Modification: [],
      Title: []
    };
    this.suppress_automatic_new_ship = false;
    this.tooltip_currently_displaying = null;
    this.randomizer_options = {
      sources: null,
      points: 100
    };
    this.total_points = 0;
    this.isCustom = false;
    this.isEpic = false;
    this.maxEpicPointsAllowed = 0;
    this.maxSmallShipsOfOneType = null;
    this.maxLargeShipsOfOneType = null;
    this.backend = null;
    this.current_squad = {};
    this.language = 'English';
    this.collection = null;
    this.setupUI();
    this.setupEventHandlers();
    this.isUpdatingPoints = false;
    if ($.getParameterByName('f') === this.faction) {
      this.resetCurrentSquad(true);
      this.loadFromSerialized($.getParameterByName('d'));
    } else {
      this.resetCurrentSquad();
      this.addShip();
    }
  }

  SquadBuilder.prototype.resetCurrentSquad = function(initial_load) {
    var default_squad_name, squad_name;
    if (initial_load == null) {
      initial_load = false;
    }
    default_squad_name = 'Unnamed Squadron';
    squad_name = $.trim(this.squad_name_input.val()) || default_squad_name;
    if (initial_load && $.trim($.getParameterByName('sn'))) {
      squad_name = $.trim($.getParameterByName('sn'));
    }
    this.current_squad = {
      id: null,
      name: squad_name,
      dirty: false,
      additional_data: {
        points: this.total_points,
        description: '',
        cards: [],
        notes: ''
      },
      faction: this.faction
    };
    if (this.total_points > 0) {
      if (squad_name === default_squad_name) {
        this.current_squad.name = 'Unsaved Squadron';
      }
      this.current_squad.dirty = true;
    }
    this.updatePermaLink();
    this.container.trigger('xwing-backend:squadNameChanged');
    return this.container.trigger('xwing-backend:squadDirtinessChanged');
  };

  SquadBuilder.prototype.newSquadFromScratch = function() {
    this.squad_name_input.val('New Squadron');
    this.removeAllShips();
    this.addShip();
    this.resetCurrentSquad();
    return this.notes.val('');
  };

  SquadBuilder.prototype.setupUI = function() {
    var DEFAULT_RANDOMIZER_ITERATIONS, DEFAULT_RANDOMIZER_POINTS, DEFAULT_RANDOMIZER_TIMEOUT_SEC, content_container, expansion, opt, _i, _len, _ref;
    DEFAULT_RANDOMIZER_POINTS = 100;
    DEFAULT_RANDOMIZER_TIMEOUT_SEC = 2;
    DEFAULT_RANDOMIZER_ITERATIONS = 1000;
    this.status_container = $(document.createElement('DIV'));
    this.status_container.addClass('container-fluid');
    this.status_container.append($.trim('<div class="row-fluid">\n    <div class="span3 squad-name-container">\n        <div class="display-name">\n            <span class="squad-name"></span>\n            <i class="icon-pencil"></i>\n        </div>\n        <div class="input-append">\n            <input type="text" maxlength="64" placeholder="Name your squad..." />\n            <button class="btn save"><i class="icon-edit"></i></button>\n        </div>\n    </div>\n    <div class="span4 points-display-container">\n        Points: <span class="total-points">0</span> / <input type="number" class="desired-points" value="100">\n        <select class="game-type-selector">\n            <option value="standard">Standard</option>\n            <option value="epic">Epic</option>\n            <option value="team-epic">Team Epic</option>\n            <option value="custom">Custom</option>\n        </select>\n        <span class="points-remaining-container">(<span class="points-remaining"></span>&nbsp;left)</span>\n        <span class="total-epic-points-container hidden"><br /><span class="total-epic-points">0</span> / <span class="max-epic-points">5</span> Epic Points</span>\n        <span class="content-warning unreleased-content-used hidden"><br /><i class="icon-exclamation-sign"></i>&nbsp;This squad uses unreleased content!</span>\n        <span class="content-warning epic-content-used hidden"><br /><i class="icon-exclamation-sign"></i>&nbsp;This squad uses Epic content!</span>\n        <span class="content-warning illegal-epic-upgrades hidden"><br /><i class="icon-exclamation-sign"></i>&nbsp;Navigator cannot be equipped onto Huge ships in Epic tournament play!</span>\n        <span class="content-warning illegal-epic-too-many-small-ships hidden"><br /><i class="icon-exclamation-sign"></i>&nbsp;You may not field more than 12 of the same type Small ship!</span>\n        <span class="content-warning illegal-epic-too-many-large-ships hidden"><br /><i class="icon-exclamation-sign"></i>&nbsp;You may not field more than 6 of the same type Large ship!</span>\n        <span class="content-warning collection-invalid hidden"><br /><i class="icon-exclamation-sign"></i>&nbsp;You cannot field this list with your collection!</span>\n    </div>\n    <div class="span5 pull-right button-container">\n        <div class="btn-group pull-right">\n\n            <button class="btn btn-primary view-as-text"><span class="hidden-phone"><i class="icon-print"></i>&nbsp;Print/View as </span>Text</button>\n            <!-- <button class="btn btn-primary print-list hidden-phone hidden-tablet"><i class="icon-print"></i>&nbsp;Print</button> -->\n            <a class="btn btn-primary hidden collection"><i class="icon-folder-open hidden-phone hidden-tabler"></i>&nbsp;Your Collection</a>\n            <a class="btn btn-primary permalink"><i class="icon-link hidden-phone hidden-tablet"></i>&nbsp;Permalink</a>\n\n            <!--\n            <button class="btn btn-primary randomize" ><i class="icon-random hidden-phone hidden-tablet"></i>&nbsp;Random!</button>\n            <button class="btn btn-primary dropdown-toggle" data-toggle="dropdown">\n                <span class="caret"></span>\n            </button>\n            <ul class="dropdown-menu">\n                <li><a class="randomize-options">Randomizer Options...</a></li>\n            </ul>\n            -->\n\n        </div>\n    </div>\n</div>\n\n<div class="row-fluid style="display: none;">\n    <div class="span12">\n        <button class="show-authenticated btn btn-primary save-list"><i class="icon-save"></i>&nbsp;Save</button>\n        <button class="show-authenticated btn btn-primary save-list-as"><i class="icon-copy"></i>&nbsp;Save As...</button>\n        <button class="show-authenticated btn btn-primary delete-list disabled"><i class="icon-trash"></i>&nbsp;Delete</button>\n        <button class="show-authenticated btn btn-primary backend-list-my-squads show-authenticated">Load Squad</button>\n        <button class="btn btn-danger clear-squad">New Squad</button>\n        <span class="show-authenticated backend-status"></span>\n    </div>\n</div>'));
    this.container.append(this.status_container);
    this.list_modal = $(document.createElement('DIV'));
    this.list_modal.addClass('modal hide fade text-list-modal');
    this.container.append(this.list_modal);
    this.list_modal.append($.trim("<div class=\"modal-header\">\n    <button type=\"button\" class=\"close hidden-print\" data-dismiss=\"modal\" aria-hidden=\"true\">&times;</button>\n\n    <div class=\"hidden-phone hidden-print\">\n        <h3><span class=\"squad-name\"></span> (<span class=\"total-points\"></span>)<h3>\n    </div>\n\n    <div class=\"visible-phone hidden-print\">\n        <h4><span class=\"squad-name\"></span> (<span class=\"total-points\"></span>)<h4>\n    </div>\n\n    <div class=\"visible-print\">\n        <div class=\"fancy-header\">\n            <div class=\"squad-name\"></div>\n            <div class=\"squad-faction\"></div>\n            <div class=\"mask\">\n                <div class=\"outer-circle\">\n                    <div class=\"inner-circle\">\n                        <span class=\"total-points\"></span>\n                    </div>\n                </div>\n            </div>\n        </div>\n        <div class=\"fancy-under-header\"></div>\n    </div>\n\n</div>\n<div class=\"modal-body\">\n    <div class=\"fancy-list hidden-phone\"></div>\n    <div class=\"simple-list\"></div>\n    <div class=\"bbcode-list\">\n        <p>Copy the BBCode below and paste it into your forum post.</p>\n        <textarea></textarea><button class=\"btn btn-copy\">Copy</button>\n    </div>\n    <div class=\"html-list\">\n        <textarea></textarea><button class=\"btn btn-copy\">Copy</button>\n    </div>\n</div>\n<div class=\"modal-footer hidden-print\">\n    <label class=\"vertical-space-checkbox\">\n        Add space for damage/upgrade cards when printing <input type=\"checkbox\" class=\"toggle-vertical-space\" />\n    </label>\n    <label class=\"color-print-checkbox\">\n        Print color <input type=\"checkbox\" class=\"toggle-color-print\" />\n    </label>\n    <label class=\"qrcode-checkbox hidden-phone\">\n        Include List Juggler QR code <input type=\"checkbox\" class=\"toggle-juggler-qrcode\" checked=\"checked\" />\n    </label>\n    <label class=\"qrcode-checkbox hidden-phone\">\n        Include obstacle silhouettes <input type=\"checkbox\" class=\"toggle-obstacles\" />\n    </label>\n    <div class=\"btn-group list-display-mode\">\n        <button class=\"btn select-simple-view\">Simple</button>\n        <button class=\"btn select-fancy-view hidden-phone\">Fancy</button>\n        <button class=\"btn select-bbcode-view\">BBCode</button>\n        <button class=\"btn select-html-view\">HTML</button>\n    </div>\n    <button class=\"btn print-list hidden-phone\"><i class=\"icon-print\"></i>&nbsp;Print</button>\n    <button class=\"btn close-print-dialog\" data-dismiss=\"modal\" aria-hidden=\"true\">Close</button>\n</div>"));
    this.fancy_container = $(this.list_modal.find('div.modal-body .fancy-list'));
    this.fancy_total_points_container = $(this.list_modal.find('div.modal-header .total-points'));
    this.simple_container = $(this.list_modal.find('div.modal-body .simple-list'));
    this.bbcode_container = $(this.list_modal.find('div.modal-body .bbcode-list'));
    this.bbcode_textarea = $(this.bbcode_container.find('textarea'));
    this.bbcode_textarea.attr('readonly', 'readonly');
    this.htmlview_container = $(this.list_modal.find('div.modal-body .html-list'));
    this.html_textarea = $(this.htmlview_container.find('textarea'));
    this.html_textarea.attr('readonly', 'readonly');
    this.toggle_vertical_space_container = $(this.list_modal.find('.vertical-space-checkbox'));
    this.toggle_color_print_container = $(this.list_modal.find('.color-print-checkbox'));
    this.list_modal.on('click', 'button.btn-copy', (function(_this) {
      return function(e) {
        _this.self = $(e.currentTarget);
        _this.self.siblings('textarea').select();
        _this.success = document.execCommand('copy');
        if (_this.success) {
          _this.self.addClass('btn-success');
          return setTimeout((function() {
            return _this.self.removeClass('btn-success');
          }), 1000);
        }
      };
    })(this));
    this.select_simple_view_button = $(this.list_modal.find('.select-simple-view'));
    this.select_simple_view_button.click((function(_this) {
      return function(e) {
        _this.select_simple_view_button.blur();
        if (_this.list_display_mode !== 'simple') {
          _this.list_modal.find('.list-display-mode .btn').removeClass('btn-inverse');
          _this.select_simple_view_button.addClass('btn-inverse');
          _this.list_display_mode = 'simple';
          _this.simple_container.show();
          _this.fancy_container.hide();
          _this.bbcode_container.hide();
          _this.htmlview_container.hide();
          _this.toggle_vertical_space_container.hide();
          return _this.toggle_color_print_container.hide();
        }
      };
    })(this));
    this.select_fancy_view_button = $(this.list_modal.find('.select-fancy-view'));
    this.select_fancy_view_button.click((function(_this) {
      return function(e) {
        _this.select_fancy_view_button.blur();
        if (_this.list_display_mode !== 'fancy') {
          _this.list_modal.find('.list-display-mode .btn').removeClass('btn-inverse');
          _this.select_fancy_view_button.addClass('btn-inverse');
          _this.list_display_mode = 'fancy';
          _this.fancy_container.show();
          _this.simple_container.hide();
          _this.bbcode_container.hide();
          _this.htmlview_container.hide();
          _this.toggle_vertical_space_container.show();
          return _this.toggle_color_print_container.show();
        }
      };
    })(this));
    this.select_bbcode_view_button = $(this.list_modal.find('.select-bbcode-view'));
    this.select_bbcode_view_button.click((function(_this) {
      return function(e) {
        _this.select_bbcode_view_button.blur();
        if (_this.list_display_mode !== 'bbcode') {
          _this.list_modal.find('.list-display-mode .btn').removeClass('btn-inverse');
          _this.select_bbcode_view_button.addClass('btn-inverse');
          _this.list_display_mode = 'bbcode';
          _this.bbcode_container.show();
          _this.htmlview_container.hide();
          _this.simple_container.hide();
          _this.fancy_container.hide();
          _this.bbcode_textarea.select();
          _this.bbcode_textarea.focus();
          _this.toggle_vertical_space_container.show();
          return _this.toggle_color_print_container.show();
        }
      };
    })(this));
    this.select_html_view_button = $(this.list_modal.find('.select-html-view'));
    this.select_html_view_button.click((function(_this) {
      return function(e) {
        _this.select_html_view_button.blur();
        if (_this.list_display_mode !== 'html') {
          _this.list_modal.find('.list-display-mode .btn').removeClass('btn-inverse');
          _this.select_html_view_button.addClass('btn-inverse');
          _this.list_display_mode = 'html';
          _this.bbcode_container.hide();
          _this.htmlview_container.show();
          _this.simple_container.hide();
          _this.fancy_container.hide();
          _this.html_textarea.select();
          _this.html_textarea.focus();
          _this.toggle_vertical_space_container.show();
          return _this.toggle_color_print_container.show();
        }
      };
    })(this));
    if ($(window).width() >= 768) {
      this.simple_container.hide();
      this.select_fancy_view_button.click();
    } else {
      this.select_simple_view_button.click();
    }
    this.clear_squad_button = $(this.status_container.find('.clear-squad'));
    this.clear_squad_button.click((function(_this) {
      return function(e) {
        if (_this.current_squad.dirty && (_this.backend != null)) {
          return _this.backend.warnUnsaved(_this, function() {
            return _this.newSquadFromScratch();
          });
        } else {
          return _this.newSquadFromScratch();
        }
      };
    })(this));
    this.squad_name_container = $(this.status_container.find('div.squad-name-container'));
    this.squad_name_display = $(this.container.find('.display-name'));
    this.squad_name_placeholder = $(this.container.find('.squad-name'));
    this.squad_name_input = $(this.squad_name_container.find('input'));
    this.squad_name_save_button = $(this.squad_name_container.find('button.save'));
    this.squad_name_input.closest('div').hide();
    this.points_container = $(this.status_container.find('div.points-display-container'));
    this.total_points_span = $(this.points_container.find('.total-points'));
    this.game_type_selector = $(this.status_container.find('.game-type-selector'));
    this.game_type_selector.change((function(_this) {
      return function(e) {
        return _this.onGameTypeChanged(_this.game_type_selector.val());
      };
    })(this));
    this.desired_points_input = $(this.points_container.find('.desired-points'));
    this.desired_points_input.change((function(_this) {
      return function(e) {
        _this.game_type_selector.val('custom');
        return _this.onGameTypeChanged('custom');
      };
    })(this));
    this.points_remaining_span = $(this.points_container.find('.points-remaining'));
    this.points_remaining_container = $(this.points_container.find('.points-remaining-container'));
    this.unreleased_content_used_container = $(this.points_container.find('.unreleased-content-used'));
    this.epic_content_used_container = $(this.points_container.find('.epic-content-used'));
    this.illegal_epic_upgrades_container = $(this.points_container.find('.illegal-epic-upgrades'));
    this.too_many_small_ships_container = $(this.points_container.find('.illegal-epic-too-many-small-ships'));
    this.too_many_large_ships_container = $(this.points_container.find('.illegal-epic-too-many-large-ships'));
    this.collection_invalid_container = $(this.points_container.find('.collection-invalid'));
    this.total_epic_points_container = $(this.points_container.find('.total-epic-points-container'));
    this.total_epic_points_span = $(this.total_epic_points_container.find('.total-epic-points'));
    this.max_epic_points_span = $(this.points_container.find('.max-epic-points'));
    this.permalink = $(this.status_container.find('div.button-container a.permalink'));
    this.view_list_button = $(this.status_container.find('div.button-container button.view-as-text'));
    this.randomize_button = $(this.status_container.find('div.button-container button.randomize'));
    this.customize_randomizer = $(this.status_container.find('div.button-container a.randomize-options'));
    this.backend_status = $(this.status_container.find('.backend-status'));
    this.backend_status.hide();
    this.collection_button = $(this.status_container.find('div.button-container a.collection'));
    this.collection_button.click((function(_this) {
      return function(e) {
        e.preventDefault();
        if (!_this.collection_button.prop('disabled')) {
          return _this.collection.modal.modal('show');
        }
      };
    })(this));
    this.squad_name_input.keypress((function(_this) {
      return function(e) {
        if (e.which === 13) {
          _this.squad_name_save_button.click();
          return false;
        }
      };
    })(this));
    this.squad_name_input.change((function(_this) {
      return function(e) {
        return _this.backend_status.fadeOut('slow');
      };
    })(this));
    this.squad_name_input.blur((function(_this) {
      return function(e) {
        _this.squad_name_input.change();
        return _this.squad_name_save_button.click();
      };
    })(this));
    this.squad_name_display.click((function(_this) {
      return function(e) {
        e.preventDefault();
        _this.squad_name_display.hide();
        _this.squad_name_input.val($.trim(_this.current_squad.name));
        window.setTimeout(function() {
          _this.squad_name_input.focus();
          return _this.squad_name_input.select();
        }, 100);
        return _this.squad_name_input.closest('div').show();
      };
    })(this));
    this.squad_name_save_button.click((function(_this) {
      return function(e) {
        var name;
        e.preventDefault();
        _this.current_squad.dirty = true;
        _this.container.trigger('xwing-backend:squadDirtinessChanged');
        name = _this.current_squad.name = $.trim(_this.squad_name_input.val());
        if (name.length > 0) {
          _this.squad_name_display.show();
          _this.container.trigger('xwing-backend:squadNameChanged');
          return _this.squad_name_input.closest('div').hide();
        }
      };
    })(this));
    this.randomizer_options_modal = $(document.createElement('DIV'));
    this.randomizer_options_modal.addClass('modal hide fade');
    $('body').append(this.randomizer_options_modal);
    this.randomizer_options_modal.append($.trim("<div class=\"modal-header\">\n    <button type=\"button\" class=\"close\" data-dismiss=\"modal\" aria-hidden=\"true\">&times;</button>\n    <h3>Random Squad Builder Options</h3>\n</div>\n<div class=\"modal-body\">\n    <form>\n        <label>\n            Desired Points\n            <input type=\"number\" class=\"randomizer-points\" value=\"" + DEFAULT_RANDOMIZER_POINTS + "\" placeholder=\"" + DEFAULT_RANDOMIZER_POINTS + "\" />\n        </label>\n        <label>\n            Sets and Expansions (default all)\n            <select class=\"randomizer-sources\" multiple=\"1\" data-placeholder=\"Use all sets and expansions\">\n            </select>\n        </label>\n        <label>\n            Maximum Seconds to Spend Randomizing\n            <input type=\"number\" class=\"randomizer-timeout\" value=\"" + DEFAULT_RANDOMIZER_TIMEOUT_SEC + "\" placeholder=\"" + DEFAULT_RANDOMIZER_TIMEOUT_SEC + "\" />\n        </label>\n        <label>\n            Maximum Randomization Iterations\n            <input type=\"number\" class=\"randomizer-iterations\" value=\"" + DEFAULT_RANDOMIZER_ITERATIONS + "\" placeholder=\"" + DEFAULT_RANDOMIZER_ITERATIONS + "\" />\n        </label>\n    </form>\n</div>\n<div class=\"modal-footer\">\n    <button class=\"btn btn-primary do-randomize\" aria-hidden=\"true\">Randomize!</button>\n    <button class=\"btn\" data-dismiss=\"modal\" aria-hidden=\"true\">Close</button>\n</div>"));
    this.randomizer_source_selector = $(this.randomizer_options_modal.find('select.randomizer-sources'));
    _ref = exportObj.expansions;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      expansion = _ref[_i];
      opt = $(document.createElement('OPTION'));
      opt.text(expansion);
      this.randomizer_source_selector.append(opt);
    }
    this.randomizer_source_selector.select2({
      width: "100%",
      minimumResultsForSearch: $.isMobile() ? -1 : 0
    });
    this.randomize_button.click((function(_this) {
      return function(e) {
        var iterations, points, timeout_sec;
        e.preventDefault();
        if (_this.current_squad.dirty && (_this.backend != null)) {
          return _this.backend.warnUnsaved(_this, function() {
            return _this.randomize_button.click();
          });
        } else {
          points = parseInt($(_this.randomizer_options_modal.find('.randomizer-points')).val());
          if (isNaN(points) || points <= 0) {
            points = DEFAULT_RANDOMIZER_POINTS;
          }
          timeout_sec = parseInt($(_this.randomizer_options_modal.find('.randomizer-timeout')).val());
          if (isNaN(timeout_sec) || timeout_sec <= 0) {
            timeout_sec = DEFAULT_RANDOMIZER_TIMEOUT_SEC;
          }
          iterations = parseInt($(_this.randomizer_options_modal.find('.randomizer-iterations')).val());
          if (isNaN(iterations) || iterations <= 0) {
            iterations = DEFAULT_RANDOMIZER_ITERATIONS;
          }
          return _this.randomSquad(points, _this.randomizer_source_selector.val(), DEFAULT_RANDOMIZER_TIMEOUT_SEC * 1000, iterations);
        }
      };
    })(this));
    this.randomizer_options_modal.find('button.do-randomize').click((function(_this) {
      return function(e) {
        e.preventDefault();
        _this.randomizer_options_modal.modal('hide');
        return _this.randomize_button.click();
      };
    })(this));
    this.customize_randomizer.click((function(_this) {
      return function(e) {
        e.preventDefault();
        return _this.randomizer_options_modal.modal();
      };
    })(this));
    this.backend_list_squads_button = $(this.container.find('button.backend-list-my-squads'));
    this.backend_list_squads_button.click((function(_this) {
      return function(e) {
        e.preventDefault();
        if (_this.backend != null) {
          return _this.backend.list(_this);
        }
      };
    })(this));
    this.backend_save_list_button = $(this.container.find('button.save-list'));
    this.backend_save_list_button.click((function(_this) {
      return function(e) {
        var additional_data, results, ___iced_passed_deferral, __iced_deferrals, __iced_k;
        __iced_k = __iced_k_noop;
        ___iced_passed_deferral = iced.findDeferral(arguments);
        e.preventDefault();
        if ((_this.backend != null) && !_this.backend_save_list_button.hasClass('disabled')) {
          additional_data = {
            points: _this.total_points,
            description: _this.describeSquad(),
            cards: _this.listCards(),
            notes: _this.notes.val().substr(0, 1024)
          };
          _this.backend_status.html($.trim("<i class=\"icon-refresh icon-spin\"></i>&nbsp;Saving squad..."));
          _this.backend_status.show();
          _this.backend_save_list_button.addClass('disabled');
          (function(__iced_k) {
            __iced_deferrals = new iced.Deferrals(__iced_k, {
              parent: ___iced_passed_deferral
            });
            _this.backend.save(_this.serialize(), _this.current_squad.id, _this.current_squad.name, _this.faction, additional_data, __iced_deferrals.defer({
              assign_fn: (function() {
                return function() {
                  return results = arguments[0];
                };
              })(),
              lineno: 17399
            }));
            __iced_deferrals._fulfill();
          })(function() {
            return __iced_k(results.success ? (_this.current_squad.dirty = false, _this.current_squad.id != null ? _this.backend_status.html($.trim("<i class=\"icon-ok\"></i>&nbsp;Squad updated successfully.")) : (_this.backend_status.html($.trim("<i class=\"icon-ok\"></i>&nbsp;New squad saved successfully.")), _this.current_squad.id = results.id), _this.container.trigger('xwing-backend:squadDirtinessChanged')) : (_this.backend_status.html($.trim("<i class=\"icon-exclamation-sign\"></i>&nbsp;" + results.error)), _this.backend_save_list_button.removeClass('disabled')));
          });
        } else {
          return __iced_k();
        }
      };
    })(this));
    this.backend_save_list_as_button = $(this.container.find('button.save-list-as'));
    this.backend_save_list_as_button.addClass('disabled');
    this.backend_save_list_as_button.click((function(_this) {
      return function(e) {
        e.preventDefault();
        if ((_this.backend != null) && !_this.backend_save_list_as_button.hasClass('disabled')) {
          return _this.backend.showSaveAsModal(_this);
        }
      };
    })(this));
    this.backend_delete_list_button = $(this.container.find('button.delete-list'));
    this.backend_delete_list_button.click((function(_this) {
      return function(e) {
        e.preventDefault();
        if ((_this.backend != null) && !_this.backend_delete_list_button.hasClass('disabled')) {
          return _this.backend.showDeleteModal(_this);
        }
      };
    })(this));
    content_container = $(document.createElement('DIV'));
    content_container.addClass('container-fluid');
    this.container.append(content_container);
    content_container.append($.trim("<div class=\"row-fluid\">\n    <div class=\"span9 ship-container\">\n                <label class=\"notes-container show-authenticated\">\n                    <span>Squad Notes:</span>\n                    <br />\n                    <textarea class=\"squad-notes\"></textarea>\n                </label>\n    </div>\n    <div class=\"span3 info-container\" />\n</div>"));
    this.ship_container = $(content_container.find('div.ship-container'));
    this.info_container = $(content_container.find('div.info-container'));
    this.notes_container = $(content_container.find('.notes-container'));
    this.notes = $(this.notes_container.find('textarea.squad-notes'));
    this.info_container.append($.trim("<div class=\"well well-small info-well\">\n    <span class=\"info-name\"></span>\n    <br />\n    <span class=\"info-sources\"></span>\n    <br />\n    <span class=\"info-collection\"></span>\n    <table>\n        <tbody>\n            <tr class=\"info-ship\">\n                <td class=\"info-header\">Ship</td>\n                <td class=\"info-data\"></td>\n            </tr>\n            <tr class=\"info-skill\">\n                <td class=\"info-header\">Skill</td>\n                <td class=\"info-data info-skill\"></td>\n            </tr>\n            <tr class=\"info-energy\">\n                <td class=\"info-header\"><i class=\"xwing-miniatures-font xwing-miniatures-font-energy\"></i></td>\n                <td class=\"info-data info-energy\"></td>\n            </tr>\n            <tr class=\"info-attack\">\n                <td class=\"info-header\"><i class=\"xwing-miniatures-font xwing-miniatures-font-attack\"></i></td>\n                <td class=\"info-data info-attack\"></td>\n            </tr>\n            <tr class=\"info-range\">\n                <td class=\"info-header\">Range</td>\n                <td class=\"info-data info-range\"></td>\n            </tr>\n            <tr class=\"info-agility\">\n                <td class=\"info-header\"><i class=\"xwing-miniatures-font xwing-miniatures-font-agility\"></i></td>\n                <td class=\"info-data info-agility\"></td>\n            </tr>\n            <tr class=\"info-hull\">\n                <td class=\"info-header\"><i class=\"xwing-miniatures-font xwing-miniatures-font-hull\"></i></td>\n                <td class=\"info-data info-hull\"></td>\n            </tr>\n            <tr class=\"info-shields\">\n                <td class=\"info-header\"><i class=\"xwing-miniatures-font xwing-miniatures-font-shield\"></i></td>\n                <td class=\"info-data info-shields\"></td>\n            </tr>\n            <tr class=\"info-actions\">\n                <td class=\"info-header\">Actions</td>\n                <td class=\"info-data\"></td>\n            </tr>\n            <tr class=\"info-upgrades\">\n                <td class=\"info-header\">Upgrades</td>\n                <td class=\"info-data\"></td>\n            </tr>\n        </tbody>\n    </table>\n    <p class=\"info-text\" />\n    <p class=\"info-maneuvers\" />\n</div>"));
    this.info_container.hide();
    this.print_list_button = $(this.container.find('button.print-list'));
    return this.container.find('[rel=tooltip]').tooltip();
  };

  SquadBuilder.prototype.setupEventHandlers = function() {
    this.container.on('xwing:claimUnique', (function(_this) {
      return function(e, unique, type, cb) {
        return _this.claimUnique(unique, type, cb);
      };
    })(this)).on('xwing:releaseUnique', (function(_this) {
      return function(e, unique, type, cb) {
        return _this.releaseUnique(unique, type, cb);
      };
    })(this)).on('xwing:pointsUpdated', (function(_this) {
      return function(e, cb) {
        if (cb == null) {
          cb = $.noop;
        }
        if (_this.isUpdatingPoints) {
          return cb();
        } else {
          _this.isUpdatingPoints = true;
          return _this.onPointsUpdated(function() {
            _this.isUpdatingPoints = false;
            return cb();
          });
        }
      };
    })(this)).on('xwing-backend:squadLoadRequested', (function(_this) {
      return function(e, squad) {
        return _this.onSquadLoadRequested(squad);
      };
    })(this)).on('xwing-backend:squadDirtinessChanged', (function(_this) {
      return function(e) {
        return _this.onSquadDirtinessChanged();
      };
    })(this)).on('xwing-backend:squadNameChanged', (function(_this) {
      return function(e) {
        return _this.onSquadNameChanged();
      };
    })(this)).on('xwing:beforeLanguageLoad', (function(_this) {
      return function(e, cb) {
        if (cb == null) {
          cb = $.noop;
        }
        _this.pretranslation_serialized = _this.serialize();
        _this.removeAllShips();
        return cb();
      };
    })(this)).on('xwing:afterLanguageLoad', (function(_this) {
      return function(e, language, cb) {
        var ship, _i, _len, _ref;
        if (cb == null) {
          cb = $.noop;
        }
        _this.language = language;
        _this.loadFromSerialized(_this.pretranslation_serialized);
        _ref = _this.ships;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          ship = _ref[_i];
          ship.updateSelections();
        }
        _this.pretranslation_serialized = void 0;
        return cb();
      };
    })(this)).on('xwing:shipUpdated', (function(_this) {
      return function(e, cb) {
        var all_allocated, ship, _i, _len, _ref;
        if (cb == null) {
          cb = $.noop;
        }
        all_allocated = true;
        _ref = _this.ships;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          ship = _ref[_i];
          ship.updateSelections();
          if (ship.ship_selector.val() === '') {
            all_allocated = false;
          }
        }
        if (all_allocated && !_this.suppress_automatic_new_ship) {
          return _this.addShip();
        }
      };
    })(this));
    $(window).on('xwing-backend:authenticationChanged', (function(_this) {
      return function(e) {
        return _this.resetCurrentSquad();
      };
    })(this)).on('xwing-collection:created', (function(_this) {
      return function(e, collection) {
        _this.collection = collection;
        _this.collection.onLanguageChange(null, _this.language);
        _this.checkCollection();
        return _this.collection_button.removeClass('hidden');
      };
    })(this)).on('xwing-collection:changed', (function(_this) {
      return function(e, collection) {
        return _this.checkCollection();
      };
    })(this)).on('xwing-collection:destroyed', (function(_this) {
      return function(e, collection) {
        _this.collection = null;
        return _this.collection_button.addClass('hidden');
      };
    })(this)).on('xwing:pingActiveBuilder', (function(_this) {
      return function(e, cb) {
        if (_this.container.is(':visible')) {
          return cb(_this);
        }
      };
    })(this)).on('xwing:activateBuilder', (function(_this) {
      return function(e, faction, cb) {
        if (faction === _this.faction) {
          _this.tab.tab('show');
          return cb(_this);
        }
      };
    })(this));
    this.view_list_button.click((function(_this) {
      return function(e) {
        e.preventDefault();
        return _this.showTextListModal();
      };
    })(this));
    this.print_list_button.click((function(_this) {
      return function(e) {
        var faction, query, ship, _i, _len, _ref;
        e.preventDefault();
        _this.printable_container.find('.printable-header').html(_this.list_modal.find('.modal-header').html());
        _this.printable_container.find('.printable-body').text('');
        switch (_this.list_display_mode) {
          case 'simple':
            _this.printable_container.find('.printable-body').html(_this.simple_container.html());
            break;
          default:
            _ref = _this.ships;
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              ship = _ref[_i];
              if (ship.pilot != null) {
                _this.printable_container.find('.printable-body').append(ship.toHTML());
              }
            }
            _this.printable_container.find('.fancy-ship').toggleClass('tall', _this.list_modal.find('.toggle-vertical-space').prop('checked'));
            _this.printable_container.find('.printable-body').toggleClass('bw', !_this.list_modal.find('.toggle-color-print').prop('checked'));
            faction = (function() {
              switch (this.faction) {
                case 'Rebel Alliance':
                  return 'rebel';
                case 'Galactic Empire':
                  return 'empire';
                case 'Scum and Villainy':
                  return 'scum';
              }
            }).call(_this);
            _this.printable_container.find('.squad-faction').html("<i class=\"xwing-miniatures-font xwing-miniatures-font-" + faction + "\"></i>");
        }
        if ($.trim(_this.notes.val()) !== '') {
          _this.printable_container.find('.printable-body').append($.trim("<h5 class=\"print-notes\">Notes:</h5>\n<pre class=\"print-notes\"></pre>"));
          _this.printable_container.find('.printable-body pre.print-notes').text(_this.notes.val());
        }
        if (_this.list_modal.find('.toggle-obstacles').prop('checked')) {
          _this.printable_container.find('.printable-body').append($.trim("<div class=\"obstacles\">\n    <div>Mark the three obstacles you are using.</div>\n    <img class=\"obstacle-silhouettes\" src=\"images/xws-obstacles.png\" />\n</div>"));
        }
        query = _this.permalink.attr('href').split(/\?/)[1].replace(/&sn=.*/, '');
        if ((query != null) && _this.list_modal.find('.toggle-juggler-qrcode').prop('checked')) {
          _this.printable_container.find('.printable-body').append($.trim("<div class=\"juggler-qrcode-container\">\n    <div class=\"juggler-qrcode-text\">Bringing this list to a tournament?  Have the TO scan this QR code to register this list with List Juggler!</div>\n    <div class=\"juggler-qrcode\"></div>\n</div>"));
          _this.printable_container.find('.juggler-qrcode').qrcode({
            render: 'div',
            ec: 'M',
            size: 144,
            text: "https://yasb-xws.herokuapp.com/juggler?" + query
          });
        }
        return window.print();
      };
    })(this));
    $(window).resize((function(_this) {
      return function() {
        if ($(window).width() < 768 && _this.list_display_mode !== 'simple') {
          return _this.select_simple_view_button.click();
        }
      };
    })(this));
    this.notes.change(this.onNotesUpdated);
    return this.notes.on('keyup', this.onNotesUpdated);
  };

  SquadBuilder.prototype.updatePermaLink = function() {
    var squad_link;
    squad_link = "" + (window.location.href.split('?')[0]) + "?f=" + (encodeURI(this.faction)) + "&d=" + (encodeURI(this.serialize())) + "&sn=" + (encodeURIComponent(this.current_squad.name));
    return this.permalink.attr('href', squad_link);
  };

  SquadBuilder.prototype.onNotesUpdated = function() {
    if (this.total_points > 0) {
      this.current_squad.dirty = true;
      return this.container.trigger('xwing-backend:squadDirtinessChanged');
    }
  };

  SquadBuilder.prototype.onGameTypeChanged = function(gametype, cb) {
    if (cb == null) {
      cb = $.noop;
    }
    switch (gametype) {
      case 'standard':
        this.isEpic = false;
        this.isCustom = false;
        this.desired_points_input.val(100);
        this.maxSmallShipsOfOneType = null;
        this.maxLargeShipsOfOneType = null;
        break;
      case 'epic':
        this.isEpic = true;
        this.isCustom = false;
        this.maxEpicPointsAllowed = 5;
        this.desired_points_input.val(300);
        this.maxSmallShipsOfOneType = 12;
        this.maxLargeShipsOfOneType = 6;
        break;
      case 'team-epic':
        this.isEpic = true;
        this.isCustom = false;
        this.maxEpicPointsAllowed = 3;
        this.desired_points_input.val(200);
        this.maxSmallShipsOfOneType = 8;
        this.maxLargeShipsOfOneType = 4;
        break;
      case 'custom':
        this.isEpic = false;
        this.isCustom = true;
        this.maxSmallShipsOfOneType = null;
        this.maxLargeShipsOfOneType = null;
    }
    this.max_epic_points_span.text(this.maxEpicPointsAllowed);
    return this.onPointsUpdated(cb);
  };

  SquadBuilder.prototype.onPointsUpdated = function(cb) {
    var bbcode_ships, count, epic_content_used, htmlview_ships, i, illegal_for_epic, points_left, ship, shipCountsByType, ship_data, ship_name, ship_uses_epic_content, ship_uses_unreleased_content, unreleased_content_used, upgrade, _i, _j, _k, _l, _len, _len1, _len2, _len3, _name, _ref, _ref1, _ref2, _ref3, _ref4;
    if (cb == null) {
      cb = $.noop;
    }
    this.total_points = 0;
    this.total_epic_points = 0;
    unreleased_content_used = false;
    epic_content_used = false;
    _ref = this.ships;
    for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
      ship = _ref[i];
      ship.validate();
      this.total_points += ship.getPoints();
      this.total_epic_points += ship.getEpicPoints();
      ship_uses_unreleased_content = ship.checkUnreleasedContent();
      if (ship_uses_unreleased_content) {
        unreleased_content_used = ship_uses_unreleased_content;
      }
      ship_uses_epic_content = ship.checkEpicContent();
      if (ship_uses_epic_content) {
        epic_content_used = ship_uses_epic_content;
      }
    }
    this.total_points_span.text(this.total_points);
    points_left = parseInt(this.desired_points_input.val()) - this.total_points;
    this.points_remaining_span.text(points_left);
    this.points_remaining_container.toggleClass('red', points_left < 0);
    this.unreleased_content_used_container.toggleClass('hidden', !unreleased_content_used);
    this.epic_content_used_container.toggleClass('hidden', this.isEpic || !epic_content_used);
    this.illegal_epic_upgrades_container.toggleClass('hidden', true);
    this.too_many_small_ships_container.toggleClass('hidden', true);
    this.too_many_large_ships_container.toggleClass('hidden', true);
    this.total_epic_points_container.toggleClass('hidden', true);
    if (this.isEpic) {
      this.total_epic_points_container.toggleClass('hidden', false);
      this.total_epic_points_span.text(this.total_epic_points);
      this.total_epic_points_span.toggleClass('red', this.total_epic_points > this.maxEpicPointsAllowed);
      shipCountsByType = {};
      illegal_for_epic = false;
      _ref1 = this.ships;
      for (i = _j = 0, _len1 = _ref1.length; _j < _len1; i = ++_j) {
        ship = _ref1[i];
        if ((ship != null ? ship.data : void 0) != null) {
          if (shipCountsByType[_name = ship.data.name] == null) {
            shipCountsByType[_name] = 0;
          }
          shipCountsByType[ship.data.name] += 1;
          if (ship.data.huge != null) {
            _ref2 = ship.upgrades;
            for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
              upgrade = _ref2[_k];
              if ((upgrade != null ? (_ref3 = upgrade.data) != null ? _ref3.epic_restriction_func : void 0 : void 0) != null) {
                if (!upgrade.data.epic_restriction_func(ship.data, upgrade)) {
                  illegal_for_epic = true;
                  break;
                }
              }
              if (illegal_for_epic) {
                break;
              }
            }
          }
        }
      }
      this.illegal_epic_upgrades_container.toggleClass('hidden', !illegal_for_epic);
      if ((this.maxLargeShipsOfOneType != null) && (this.maxSmallShipsOfOneType != null)) {
        for (ship_name in shipCountsByType) {
          count = shipCountsByType[ship_name];
          ship_data = exportObj.ships[ship_name];
          if ((ship_data.large != null) && count > this.maxLargeShipsOfOneType) {
            this.too_many_large_ships_container.toggleClass('hidden', false);
          } else if ((ship.huge == null) && count > this.maxSmallShipsOfOneType) {
            this.too_many_small_ships_container.toggleClass('hidden', false);
          }
        }
      }
    }
    this.fancy_total_points_container.text(this.total_points);
    this.updatePermaLink();
    this.fancy_container.text('');
    this.simple_container.html('<table class="simple-table"></table>');
    bbcode_ships = [];
    htmlview_ships = [];
    _ref4 = this.ships;
    for (_l = 0, _len3 = _ref4.length; _l < _len3; _l++) {
      ship = _ref4[_l];
      if (ship.pilot != null) {
        this.fancy_container.append(ship.toHTML());
        this.simple_container.find('table').append(ship.toTableRow());
        bbcode_ships.push(ship.toBBCode());
        htmlview_ships.push(ship.toSimpleHTML());
      }
    }
    this.htmlview_container.find('textarea').val($.trim("" + (htmlview_ships.join('<br />')) + "\n<br />\n<b><i>Total: " + this.total_points + "</i></b>\n<br />\n<a href=\"" + (this.permalink.attr('href')) + "\">View in Yet Another Squad Builder</a>"));
    this.bbcode_container.find('textarea').val($.trim("" + (bbcode_ships.join("\n\n")) + "\n\n[b][i]Total: " + this.total_points + "[/i][/b]\n\n[url=" + (this.permalink.attr('href')) + "]View in Yet Another Squad Builder[/url]"));
    this.checkCollection();
    return cb(this.total_points);
  };

  SquadBuilder.prototype.onSquadLoadRequested = function(squad) {
    var _ref;
    this.current_squad = squad;
    this.backend_delete_list_button.removeClass('disabled');
    this.squad_name_input.val(this.current_squad.name);
    this.squad_name_placeholder.text(this.current_squad.name);
    this.loadFromSerialized(squad.serialized);
    this.notes.val((_ref = squad.additional_data.notes) != null ? _ref : '');
    this.backend_status.fadeOut('slow');
    this.current_squad.dirty = false;
    return this.container.trigger('xwing-backend:squadDirtinessChanged');
  };

  SquadBuilder.prototype.onSquadDirtinessChanged = function() {
    this.backend_save_list_button.toggleClass('disabled', !(this.current_squad.dirty && this.total_points > 0));
    this.backend_save_list_as_button.toggleClass('disabled', this.total_points === 0);
    return this.backend_delete_list_button.toggleClass('disabled', this.current_squad.id == null);
  };

  SquadBuilder.prototype.onSquadNameChanged = function() {
    var short_name;
    if (this.current_squad.name.length > SQUAD_DISPLAY_NAME_MAX_LENGTH) {
      short_name = "" + (this.current_squad.name.substr(0, SQUAD_DISPLAY_NAME_MAX_LENGTH)) + "&hellip;";
    } else {
      short_name = this.current_squad.name;
    }
    this.squad_name_placeholder.text('');
    this.squad_name_placeholder.append(short_name);
    this.squad_name_input.val(this.current_squad.name);
    return this.updatePermaLink();
  };

  SquadBuilder.prototype.removeAllShips = function() {
    while (this.ships.length > 0) {
      this.removeShip(this.ships[0]);
    }
    if (this.ships.length > 0) {
      throw new Error("Ships not emptied");
    }
  };

  SquadBuilder.prototype.showTextListModal = function() {
    return this.list_modal.modal('show');
  };

  SquadBuilder.prototype.serialize = function() {
    var game_type_abbrev, serialization_version, ship;
    serialization_version = 4;
    game_type_abbrev = (function() {
      switch (this.game_type_selector.val()) {
        case 'standard':
          return 's';
        case 'epic':
          return 'e';
        case 'team-epic':
          return 't';
        case 'custom':
          return "c=" + ($.trim(this.desired_points_input.val()));
      }
    }).call(this);
    return "v" + serialization_version + "!" + game_type_abbrev + "!" + (((function() {
      var _i, _len, _ref, _results;
      _ref = this.ships;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        ship = _ref[_i];
        if (ship.pilot != null) {
          _results.push(ship.toSerialized());
        }
      }
      return _results;
    }).call(this)).join(';'));
  };

  SquadBuilder.prototype.loadFromSerialized = function(serialized) {
    var game_type_abbrev, matches, new_ship, re, serialized_ship, serialized_ships, version, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2, _ref3;
    this.suppress_automatic_new_ship = true;
    this.removeAllShips();
    re = /^v(\d+)!(.*)/;
    matches = re.exec(serialized);
    if (matches != null) {
      version = parseInt(matches[1]);
      switch (version) {
        case 3:
        case 4:
          _ref = matches[2].split('!'), game_type_abbrev = _ref[0], serialized_ships = _ref[1];
          switch (game_type_abbrev) {
            case 's':
              this.game_type_selector.val('standard');
              this.game_type_selector.change();
              break;
            case 'e':
              this.game_type_selector.val('epic');
              this.game_type_selector.change();
              break;
            case 't':
              this.game_type_selector.val('team-epic');
              this.game_type_selector.change();
              break;
            default:
              this.game_type_selector.val('custom');
              this.desired_points_input.val(parseInt(game_type_abbrev.split('=')[1]));
              this.desired_points_input.change();
          }
          _ref1 = serialized_ships.split(';');
          for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
            serialized_ship = _ref1[_i];
            if (serialized_ship !== '') {
              new_ship = this.addShip();
              new_ship.fromSerialized(version, serialized_ship);
            }
          }
          break;
        case 2:
          _ref2 = matches[2].split(';');
          for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
            serialized_ship = _ref2[_j];
            if (serialized_ship !== '') {
              new_ship = this.addShip();
              new_ship.fromSerialized(version, serialized_ship);
            }
          }
      }
    } else {
      _ref3 = serialized.split(';');
      for (_k = 0, _len2 = _ref3.length; _k < _len2; _k++) {
        serialized_ship = _ref3[_k];
        if (serialized !== '') {
          new_ship = this.addShip();
          new_ship.fromSerialized(1, serialized_ship);
        }
      }
    }
    this.suppress_automatic_new_ship = false;
    return this.addShip();
  };

  SquadBuilder.prototype.uniqueIndex = function(unique, type) {
    if (!(type in this.uniques_in_use)) {
      throw new Error("Invalid unique type '" + type + "'");
    }
    return this.uniques_in_use[type].indexOf(unique);
  };

  SquadBuilder.prototype.claimUnique = function(unique, type, cb) {
    var bycanonical, canonical, other, otherslot, _i, _len, _ref, _ref1;
    if (this.uniqueIndex(unique, type) < 0) {
      _ref = exportObj.pilotsByFactionCanonicalName[this.faction][unique.canonical_name] || [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        other = _ref[_i];
        if (unique !== other) {
          if (this.uniqueIndex(other, 'Pilot') < 0) {
            this.uniques_in_use['Pilot'].push(other);
          } else {
            throw new Error("Unique " + type + " '" + unique.name + "' already claimed as pilot");
          }
        }
      }
      _ref1 = exportObj.upgradesBySlotCanonicalName;
      for (otherslot in _ref1) {
        bycanonical = _ref1[otherslot];
        for (canonical in bycanonical) {
          other = bycanonical[canonical];
          if (canonical === unique.canonical_name && unique !== other) {
            if (this.uniqueIndex(other, 'Upgrade') < 0) {
              this.uniques_in_use['Upgrade'].push(other);
            }
          }
        }
      }
      this.uniques_in_use[type].push(unique);
    } else {
      throw new Error("Unique " + type + " '" + unique.name + "' already claimed");
    }
    return cb();
  };

  SquadBuilder.prototype.releaseUnique = function(unique, type, cb) {
    var idx, u, uniques, _i, _len, _ref;
    idx = this.uniqueIndex(unique, type);
    if (idx >= 0) {
      _ref = this.uniques_in_use;
      for (type in _ref) {
        uniques = _ref[type];
        this.uniques_in_use[type] = [];
        for (_i = 0, _len = uniques.length; _i < _len; _i++) {
          u = uniques[_i];
          if (u.canonical_name !== unique.canonical_name) {
            this.uniques_in_use[type].push(u);
          }
        }
      }
    } else {
      throw new Error("Unique " + type + " '" + unique.name + "' not in use");
    }
    return cb();
  };

  SquadBuilder.prototype.addShip = function() {
    var new_ship;
    new_ship = new Ship({
      builder: this,
      container: this.ship_container
    });
    this.ships.push(new_ship);
    return new_ship;
  };

  SquadBuilder.prototype.removeShip = function(ship) {
    var ___iced_passed_deferral, __iced_deferrals, __iced_k;
    __iced_k = __iced_k_noop;
    ___iced_passed_deferral = iced.findDeferral(arguments);
    (function(_this) {
      return (function(__iced_k) {
        __iced_deferrals = new iced.Deferrals(__iced_k, {
          parent: ___iced_passed_deferral,
          funcname: "SquadBuilder.removeShip"
        });
        ship.destroy(__iced_deferrals.defer({
          lineno: 17923
        }));
        __iced_deferrals._fulfill();
      });
    })(this)((function(_this) {
      return function() {
        (function(__iced_k) {
          __iced_deferrals = new iced.Deferrals(__iced_k, {
            parent: ___iced_passed_deferral,
            funcname: "SquadBuilder.removeShip"
          });
          _this.container.trigger('xwing:pointsUpdated', __iced_deferrals.defer({
            lineno: 17924
          }));
          __iced_deferrals._fulfill();
        })(function() {
          _this.current_squad.dirty = true;
          return _this.container.trigger('xwing-backend:squadDirtinessChanged');
        });
      };
    })(this));
  };

  SquadBuilder.prototype.matcher = function(item, term) {
    return item.toUpperCase().indexOf(term.toUpperCase()) >= 0;
  };

  SquadBuilder.prototype.isOurFaction = function(faction) {
    var f, _i, _len;
    if (faction instanceof Array) {
      for (_i = 0, _len = faction.length; _i < _len; _i++) {
        f = faction[_i];
        if (getPrimaryFaction(f) === this.faction) {
          return true;
        }
      }
      return false;
    } else {
      return getPrimaryFaction(faction) === this.faction;
    }
  };

  SquadBuilder.prototype.getAvailableShipsMatching = function(term) {
    var ship_data, ship_name, ships, _ref;
    if (term == null) {
      term = '';
    }
    ships = [];
    _ref = exportObj.ships;
    for (ship_name in _ref) {
      ship_data = _ref[ship_name];
      if (this.isOurFaction(ship_data.factions) && this.matcher(ship_data.name, term)) {
        if (!ship_data.huge || (this.isEpic || this.isCustom)) {
          ships.push({
            id: ship_data.name,
            text: ship_data.name,
            english_name: ship_data.english_name
          });
        }
      }
    }
    return ships.sort(exportObj.sortHelper);
  };

  SquadBuilder.prototype.getAvailablePilotsForShipIncluding = function(ship, include_pilot, term) {
    var available_faction_pilots, eligible_faction_pilots, pilot, pilot_name;
    if (term == null) {
      term = '';
    }
    available_faction_pilots = (function() {
      var _ref, _results;
      _ref = exportObj.pilotsByLocalizedName;
      _results = [];
      for (pilot_name in _ref) {
        pilot = _ref[pilot_name];
        if (((ship == null) || pilot.ship === ship) && this.isOurFaction(pilot.faction) && this.matcher(pilot_name, term)) {
          _results.push(pilot);
        }
      }
      return _results;
    }).call(this);
    eligible_faction_pilots = (function() {
      var _results;
      _results = [];
      for (pilot_name in available_faction_pilots) {
        pilot = available_faction_pilots[pilot_name];
        if ((pilot.unique == null) || __indexOf.call(this.uniques_in_use['Pilot'], pilot) < 0) {
          _results.push(pilot);
        }
      }
      return _results;
    }).call(this);
    if ((include_pilot != null) && (include_pilot.unique != null) && this.matcher(include_pilot.name, term)) {
      eligible_faction_pilots.push(include_pilot);
    }
    return ((function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = available_faction_pilots.length; _i < _len; _i++) {
        pilot = available_faction_pilots[_i];
        _results.push({
          id: pilot.id,
          text: "" + pilot.name + " (" + pilot.points + ")",
          points: pilot.points,
          ship: pilot.ship,
          english_name: pilot.english_name,
          disabled: __indexOf.call(eligible_faction_pilots, pilot) < 0
        });
      }
      return _results;
    })()).sort(exportObj.sortHelper);
  };

  dfl_filter_func = function() {
    return true;
  };

  SquadBuilder.prototype.getAvailableUpgradesIncluding = function(slot, include_upgrade, ship, this_upgrade_obj, term, filter_func) {
    var available_upgrades, eligible_upgrades, equipped_upgrade, limited_upgrades_in_use, m, retval, upgrade, upgrade_name, _i, _j, _len, _len1, _ref, _ref1, _ref2, _ref3, _results;
    if (term == null) {
      term = '';
    }
    if (filter_func == null) {
      filter_func = this.dfl_filter_func;
    }
    limited_upgrades_in_use = (function() {
      var _i, _len, _ref, _ref1, _results;
      _ref = ship.upgrades;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        upgrade = _ref[_i];
        if ((upgrade != null ? (_ref1 = upgrade.data) != null ? _ref1.limited : void 0 : void 0) != null) {
          _results.push(upgrade.data);
        }
      }
      return _results;
    })();
    available_upgrades = (function() {
      var _ref, _results;
      _ref = exportObj.upgradesByLocalizedName;
      _results = [];
      for (upgrade_name in _ref) {
        upgrade = _ref[upgrade_name];
        if (upgrade.slot === slot && this.matcher(upgrade_name, term) && ((upgrade.ship == null) || upgrade.ship === ship.data.name) && ((upgrade.faction == null) || this.isOurFaction(upgrade.faction)) && ((this.isEpic || this.isCustom) || upgrade.restriction_func !== exportObj.hugeOnly)) {
          _results.push(upgrade);
        }
      }
      return _results;
    }).call(this);
    if (filter_func !== this.dfl_filter_func) {
      available_upgrades = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = available_upgrades.length; _i < _len; _i++) {
          upgrade = available_upgrades[_i];
          if (filter_func(upgrade)) {
            _results.push(upgrade);
          }
        }
        return _results;
      })();
    }
    if ((this.isEpic || this.isCustom) && slot === 'Hardpoint' && (_ref = 'Ordnance Tubes'.canonicalize(), __indexOf.call((function() {
      var _i, _len, _ref1, _results;
      _ref1 = ship.modifications;
      _results = [];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        m = _ref1[_i];
        if (m.data != null) {
          _results.push(m.data.canonical_name);
        }
      }
      return _results;
    })(), _ref) >= 0)) {
      available_upgrades = available_upgrades.concat((function() {
        var _ref1, _ref2, _results;
        _ref1 = exportObj.upgradesByLocalizedName;
        _results = [];
        for (upgrade_name in _ref1) {
          upgrade = _ref1[upgrade_name];
          if (((_ref2 = upgrade.slot) === 'Missile' || _ref2 === 'Torpedo') && this.matcher(upgrade_name, term) && ((upgrade.ship == null) || upgrade.ship === ship.data.name) && ((upgrade.faction == null) || this.isOurFaction(upgrade.faction)) && ((this.isEpic || this.isCustom) || upgrade.restriction_func !== exportObj.hugeOnly)) {
            _results.push(upgrade);
          }
        }
        return _results;
      }).call(this));
    }
    eligible_upgrades = (function() {
      var _results;
      _results = [];
      for (upgrade_name in available_upgrades) {
        upgrade = available_upgrades[upgrade_name];
        if (((upgrade.unique == null) || __indexOf.call(this.uniques_in_use['Upgrade'], upgrade) < 0) && (!((ship != null) && (upgrade.restriction_func != null)) || upgrade.restriction_func(ship, this_upgrade_obj)) && __indexOf.call(limited_upgrades_in_use, upgrade) < 0) {
          _results.push(upgrade);
        }
      }
      return _results;
    }).call(this);
    if ((ship != null ? (_ref1 = ship.title) != null ? (_ref2 = _ref1.data) != null ? _ref2.special_case : void 0 : void 0 : void 0) === 'A-Wing Test Pilot') {
      _ref3 = (function() {
        var _j, _len, _ref3, _results;
        _ref3 = ship.upgrades;
        _results = [];
        for (_j = 0, _len = _ref3.length; _j < _len; _j++) {
          upgrade = _ref3[_j];
          if ((upgrade != null ? upgrade.data : void 0) != null) {
            _results.push(upgrade.data);
          }
        }
        return _results;
      })();
      for (_i = 0, _len = _ref3.length; _i < _len; _i++) {
        equipped_upgrade = _ref3[_i];
        eligible_upgrades.removeItem(equipped_upgrade);
      }
    }
    if ((include_upgrade != null) && (((include_upgrade.unique != null) || (include_upgrade.limited != null)) && this.matcher(include_upgrade.name, term))) {
      eligible_upgrades.push(include_upgrade);
    }
    retval = ((function() {
      var _j, _len1, _results;
      _results = [];
      for (_j = 0, _len1 = available_upgrades.length; _j < _len1; _j++) {
        upgrade = available_upgrades[_j];
        _results.push({
          id: upgrade.id,
          text: "" + upgrade.name + " (" + upgrade.points + ")",
          points: upgrade.points,
          english_name: upgrade.english_name,
          disabled: __indexOf.call(eligible_upgrades, upgrade) < 0
        });
      }
      return _results;
    })()).sort(exportObj.sortHelper);
    if (this_upgrade_obj.adjustment_func != null) {
      _results = [];
      for (_j = 0, _len1 = retval.length; _j < _len1; _j++) {
        upgrade = retval[_j];
        _results.push(this_upgrade_obj.adjustment_func(upgrade));
      }
      return _results;
    } else {
      return retval;
    }
  };

  SquadBuilder.prototype.getAvailableModificationsIncluding = function(include_modification, ship, term) {
    var available_modifications, eligible_modifications, equipped_modification, modification, modification_name, _i, _len, _ref, _ref1, _ref2;
    if (term == null) {
      term = '';
    }
    available_modifications = (function() {
      var _ref, _results;
      _ref = exportObj.modificationsByLocalizedName;
      _results = [];
      for (modification_name in _ref) {
        modification = _ref[modification_name];
        if (this.matcher(modification_name, term) && ((modification.ship == null) || modification.ship === ship.data.name)) {
          _results.push(modification);
        }
      }
      return _results;
    }).call(this);
    if ((ship != null) && exportObj.hugeOnly(ship) > 0) {
      available_modifications = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = available_modifications.length; _i < _len; _i++) {
          modification = available_modifications[_i];
          if ((modification.ship != null) || (modification.restriction_func == null) || modification.restriction_func(ship)) {
            _results.push(modification);
          }
        }
        return _results;
      })();
    }
    eligible_modifications = (function() {
      var _results;
      _results = [];
      for (modification_name in available_modifications) {
        modification = available_modifications[modification_name];
        if (((modification.unique == null) || __indexOf.call(this.uniques_in_use['Modification'], modification) < 0) && ((modification.faction == null) || this.isOurFaction(modification.faction)) && (!((ship != null) && (modification.restriction_func != null)) || modification.restriction_func(ship))) {
          _results.push(modification);
        }
      }
      return _results;
    }).call(this);
    if ((ship != null ? (_ref = ship.title) != null ? (_ref1 = _ref.data) != null ? _ref1.special_case : void 0 : void 0 : void 0) === 'Royal Guard TIE') {
      _ref2 = (function() {
        var _j, _len, _ref2, _results;
        _ref2 = ship.modifications;
        _results = [];
        for (_j = 0, _len = _ref2.length; _j < _len; _j++) {
          modification = _ref2[_j];
          if ((modification != null ? modification.data : void 0) != null) {
            _results.push(modification.data);
          }
        }
        return _results;
      })();
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        equipped_modification = _ref2[_i];
        eligible_modifications.removeItem(equipped_modification);
      }
    }
    if ((include_modification != null) && ((include_modification.unique != null) && this.matcher(include_modification.name, term))) {
      eligible_modifications.push(include_modification);
    }
    return ((function() {
      var _j, _len1, _results;
      _results = [];
      for (_j = 0, _len1 = available_modifications.length; _j < _len1; _j++) {
        modification = available_modifications[_j];
        _results.push({
          id: modification.id,
          text: "" + modification.name + " (" + modification.points + ")",
          points: modification.points,
          english_name: modification.english_name,
          disabled: __indexOf.call(eligible_modifications, modification) < 0
        });
      }
      return _results;
    })()).sort(exportObj.sortHelper);
  };

  SquadBuilder.prototype.getAvailableTitlesIncluding = function(ship, include_title, term) {
    var available_titles, eligible_titles, title, title_name;
    if (term == null) {
      term = '';
    }
    available_titles = (function() {
      var _ref, _results;
      _ref = exportObj.titlesByLocalizedName;
      _results = [];
      for (title_name in _ref) {
        title = _ref[title_name];
        if (title.ship === ship.data.name && this.matcher(title_name, term)) {
          _results.push(title);
        }
      }
      return _results;
    }).call(this);
    eligible_titles = (function() {
      var _results;
      _results = [];
      for (title_name in available_titles) {
        title = available_titles[title_name];
        if (((title.unique == null) || __indexOf.call(this.uniques_in_use['Title'], title) < 0) && ((title.faction == null) || this.isOurFaction(title.faction)) && (!((ship != null) && (title.restriction_func != null)) || title.restriction_func(ship))) {
          _results.push(title);
        }
      }
      return _results;
    }).call(this);
    if ((include_title != null) && (include_title.unique != null) && this.matcher(include_title.name, term)) {
      eligible_titles.push(include_title);
    }
    return ((function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = available_titles.length; _i < _len; _i++) {
        title = available_titles[_i];
        _results.push({
          id: title.id,
          text: "" + title.name + " (" + title.points + ")",
          points: title.points,
          english_name: title.english_name,
          disabled: __indexOf.call(eligible_titles, title) < 0
        });
      }
      return _results;
    })()).sort(exportObj.sortHelper);
  };

  SquadBuilder.prototype.getManeuverTableHTML = function(maneuvers, baseManeuvers) {
    var bearing, bearings, bearings_without_maneuvers, color, difficulty, haveManeuver, linePath, outTable, outlineColor, speed, transform, trianglePath, turn, v, _i, _j, _k, _l, _len, _len1, _len2, _m, _n, _ref, _ref1, _ref2, _ref3, _results;
    if ((maneuvers == null) || maneuvers.length === 0) {
      return "Missing maneuver info.";
    }
    bearings_without_maneuvers = (function() {
      _results = [];
      for (var _i = 0, _ref = maneuvers[0].length; 0 <= _ref ? _i < _ref : _i > _ref; 0 <= _ref ? _i++ : _i--){ _results.push(_i); }
      return _results;
    }).apply(this);
    for (_j = 0, _len = maneuvers.length; _j < _len; _j++) {
      bearings = maneuvers[_j];
      for (bearing = _k = 0, _len1 = bearings.length; _k < _len1; bearing = ++_k) {
        difficulty = bearings[bearing];
        if (difficulty > 0) {
          bearings_without_maneuvers.removeItem(bearing);
        }
      }
    }
    outTable = "<table><tbody>";
    for (speed = _l = _ref1 = maneuvers.length - 1; _ref1 <= 0 ? _l <= 0 : _l >= 0; speed = _ref1 <= 0 ? ++_l : --_l) {
      haveManeuver = false;
      _ref2 = maneuvers[speed];
      for (_m = 0, _len2 = _ref2.length; _m < _len2; _m++) {
        v = _ref2[_m];
        if (v > 0) {
          haveManeuver = true;
          break;
        }
      }
      if (!haveManeuver) {
        continue;
      }
      outTable += "<tr><td>" + speed + "</td>";
      for (turn = _n = 0, _ref3 = maneuvers[speed].length; 0 <= _ref3 ? _n < _ref3 : _n > _ref3; turn = 0 <= _ref3 ? ++_n : --_n) {
        if (__indexOf.call(bearings_without_maneuvers, turn) >= 0) {
          continue;
        }
        outTable += "<td>";
        if (maneuvers[speed][turn] > 0) {
          color = (function() {
            switch (maneuvers[speed][turn]) {
              case 1:
                return "white";
              case 2:
                return "green";
              case 3:
                return "red";
            }
          })();
          outTable += "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"30px\" height=\"30px\" viewBox=\"0 0 200 200\">";
          if (speed === 0) {
            outTable += "<rect x=\"50\" y=\"50\" width=\"100\" height=\"100\" style=\"fill:" + color + "\" />";
          } else {
            outlineColor = "black";
            if (maneuvers[speed][turn] !== baseManeuvers[speed][turn]) {
              outlineColor = "gold";
            }
            transform = "";
            switch (turn) {
              case 0:
                linePath = "M160,180 L160,70 80,70";
                trianglePath = "M80,100 V40 L30,70 Z";
                break;
              case 1:
                linePath = "M150,180 S150,120 80,60";
                trianglePath = "M80,100 V40 L30,70 Z";
                transform = "transform='translate(-5 -15) rotate(45 70 90)' ";
                break;
              case 2:
                linePath = "M100,180 L100,100 100,80";
                trianglePath = "M70,80 H130 L100,30 Z";
                break;
              case 3:
                linePath = "M50,180 S50,120 120,60";
                trianglePath = "M120,100 V40 L170,70 Z";
                transform = "transform='translate(5 -15) rotate(-45 130 90)' ";
                break;
              case 4:
                linePath = "M40,180 L40,70 120,70";
                trianglePath = "M120,100 V40 L170,70 Z";
                break;
              case 5:
                linePath = "M50,180 L50,100 C50,10 140,10 140,100 L140,120";
                trianglePath = "M170,120 H110 L140,180 Z";
                break;
              case 6:
                linePath = "M150,180 S150,120 80,60";
                trianglePath = "M80,100 V40 L30,70 Z";
                transform = "transform='translate(0 50)'";
                break;
              case 7:
                linePath = "M50,180 S50,120 120,60";
                trianglePath = "M120,100 V40 L170,70 Z";
                transform = "transform='translate(0 50)'";
                break;
              case 8:
                linePath = "M160,180 L160,70 80,70";
                trianglePath = "M60,100 H100 L80,140 Z";
                break;
              case 9:
                linePath = "M40,180 L40,70 120,70";
                trianglePath = "M100,100 H140 L120,140 Z";
            }
            outTable += $.trim("<path d='" + trianglePath + "' fill='" + color + "' stroke-width='5' stroke='" + outlineColor + "' " + transform + "/>\n<path stroke-width='25' fill='none' stroke='" + outlineColor + "' d='" + linePath + "' />\n<path stroke-width='15' fill='none' stroke='" + color + "' d='" + linePath + "' />");
          }
          outTable += "</svg>";
        }
        outTable += "</td>";
      }
      outTable += "</tr>";
    }
    outTable += "</tbody></table>";
    return outTable;
  };

  SquadBuilder.prototype.showTooltip = function(type, data, additional_opts) {
    var a, action, addon_count, effective_stats, extra_actions, pilot_count, ship, ship_count, slot, source, _ref, _ref1, _ref10, _ref11, _ref12, _ref13, _ref14, _ref15, _ref16, _ref17, _ref18, _ref19, _ref2, _ref20, _ref21, _ref22, _ref23, _ref24, _ref25, _ref26, _ref27, _ref28, _ref29, _ref3, _ref30, _ref31, _ref32, _ref33, _ref34, _ref35, _ref36, _ref37, _ref38, _ref39, _ref4, _ref40, _ref41, _ref42, _ref43, _ref5, _ref6, _ref7, _ref8, _ref9;
    if (data !== this.tooltip_currently_displaying) {
      switch (type) {
        case 'Ship':
          this.info_container.find('.info-sources').text(((function() {
            var _i, _len, _ref, _results;
            _ref = data.pilot.sources;
            _results = [];
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              source = _ref[_i];
              _results.push(exportObj.translate(this.language, 'sources', source));
            }
            return _results;
          }).call(this)).sort().join(', '));
          if (((_ref = this.collection) != null ? _ref.counts : void 0) != null) {
            ship_count = (_ref1 = (_ref2 = this.collection.counts) != null ? (_ref3 = _ref2.ship) != null ? _ref3[data.data.english_name] : void 0 : void 0) != null ? _ref1 : 0;
            pilot_count = (_ref4 = (_ref5 = this.collection.counts) != null ? (_ref6 = _ref5.pilot) != null ? _ref6[data.pilot.english_name] : void 0 : void 0) != null ? _ref4 : 0;
            this.info_container.find('.info-collection').text("You have " + ship_count + " ship model" + (ship_count > 1 ? 's' : '') + " and " + pilot_count + " pilot card" + (pilot_count > 1 ? 's' : '') + " in your collection.");
          } else {
            this.info_container.find('.info-collection').text('');
          }
          effective_stats = data.effectiveStats();
          extra_actions = $.grep(effective_stats.actions, function(el, i) {
            return __indexOf.call(data.data.actions, el) < 0;
          });
          this.info_container.find('.info-name').html("" + (data.pilot.unique ? "&middot;&nbsp;" : "") + data.pilot.name + (data.pilot.epic != null ? " (" + (exportObj.translate(this.language, 'ui', 'epic')) + ")" : "") + (exportObj.isReleased(data.pilot) ? "" : " (" + (exportObj.translate(this.language, 'ui', 'unreleased')) + ")"));
          this.info_container.find('p.info-text').html((_ref7 = data.pilot.text) != null ? _ref7 : '');
          this.info_container.find('tr.info-ship td.info-data').text(data.pilot.ship);
          this.info_container.find('tr.info-ship').show();
          this.info_container.find('tr.info-skill td.info-data').text(statAndEffectiveStat(data.pilot.skill, effective_stats, 'skill'));
          this.info_container.find('tr.info-skill').show();
          this.info_container.find('tr.info-attack td.info-data').text(statAndEffectiveStat((_ref8 = (_ref9 = data.pilot.ship_override) != null ? _ref9.attack : void 0) != null ? _ref8 : data.data.attack, effective_stats, 'attack'));
          this.info_container.find('tr.info-attack').toggle((((_ref10 = data.pilot.ship_override) != null ? _ref10.attack : void 0) != null) || (data.data.attack != null));
          this.info_container.find('tr.info-energy td.info-data').text(statAndEffectiveStat((_ref11 = (_ref12 = data.pilot.ship_override) != null ? _ref12.energy : void 0) != null ? _ref11 : data.data.energy, effective_stats, 'energy'));
          this.info_container.find('tr.info-energy').toggle((((_ref13 = data.pilot.ship_override) != null ? _ref13.energy : void 0) != null) || (data.data.energy != null));
          this.info_container.find('tr.info-range').hide();
          this.info_container.find('tr.info-agility td.info-data').text(statAndEffectiveStat((_ref14 = (_ref15 = data.pilot.ship_override) != null ? _ref15.agility : void 0) != null ? _ref14 : data.data.agility, effective_stats, 'agility'));
          this.info_container.find('tr.info-agility').show();
          this.info_container.find('tr.info-hull td.info-data').text(statAndEffectiveStat((_ref16 = (_ref17 = data.pilot.ship_override) != null ? _ref17.hull : void 0) != null ? _ref16 : data.data.hull, effective_stats, 'hull'));
          this.info_container.find('tr.info-hull').show();
          this.info_container.find('tr.info-shields td.info-data').text(statAndEffectiveStat((_ref18 = (_ref19 = data.pilot.ship_override) != null ? _ref19.shields : void 0) != null ? _ref18 : data.data.shields, effective_stats, 'shields'));
          this.info_container.find('tr.info-shields').show();
          this.info_container.find('tr.info-actions td.info-data').html(((function() {
            var _i, _len, _ref20, _results;
            _ref20 = data.data.actions.concat((function() {
              var _j, _len, _results1;
              _results1 = [];
              for (_j = 0, _len = extra_actions.length; _j < _len; _j++) {
                action = extra_actions[_j];
                _results1.push("<strong>" + (exportObj.translate(this.language, 'action', action)) + "</strong>");
              }
              return _results1;
            }).call(this));
            _results = [];
            for (_i = 0, _len = _ref20.length; _i < _len; _i++) {
              a = _ref20[_i];
              _results.push(exportObj.translate(this.language, 'action', a));
            }
            return _results;
          }).call(this)).join(', '));
          this.info_container.find('tr.info-actions').show();
          this.info_container.find('tr.info-upgrades').show();
          this.info_container.find('tr.info-upgrades td.info-data').text(((function() {
            var _i, _len, _ref20, _results;
            _ref20 = data.pilot.slots;
            _results = [];
            for (_i = 0, _len = _ref20.length; _i < _len; _i++) {
              slot = _ref20[_i];
              _results.push(exportObj.translate(this.language, 'slot', slot));
            }
            return _results;
          }).call(this)).join(', ') || 'None');
          this.info_container.find('p.info-maneuvers').show();
          this.info_container.find('p.info-maneuvers').html(this.getManeuverTableHTML(effective_stats.maneuvers, data.data.maneuvers));
          break;
        case 'Pilot':
          this.info_container.find('.info-sources').text(((function() {
            var _i, _len, _ref20, _results;
            _ref20 = data.sources;
            _results = [];
            for (_i = 0, _len = _ref20.length; _i < _len; _i++) {
              source = _ref20[_i];
              _results.push(exportObj.translate(this.language, 'sources', source));
            }
            return _results;
          }).call(this)).sort().join(', '));
          if (((_ref20 = this.collection) != null ? _ref20.counts : void 0) != null) {
            pilot_count = (_ref21 = (_ref22 = this.collection.counts) != null ? (_ref23 = _ref22.pilot) != null ? _ref23[data.english_name] : void 0 : void 0) != null ? _ref21 : 0;
            ship_count = (_ref24 = (_ref25 = this.collection.counts.ship) != null ? _ref25[additional_opts.ship] : void 0) != null ? _ref24 : 0;
            this.info_container.find('.info-collection').text("You have " + ship_count + " ship model" + (ship_count > 1 ? 's' : '') + " and " + pilot_count + " pilot card" + (pilot_count > 1 ? 's' : '') + " in your collection.");
          } else {
            this.info_container.find('.info-collection').text('');
          }
          this.info_container.find('.info-name').html("" + (data.unique ? "&middot;&nbsp;" : "") + data.name + (data.epic != null ? " (" + (exportObj.translate(this.language, 'ui', 'epic')) + ")" : "") + (exportObj.isReleased(data) ? "" : " (" + (exportObj.translate(this.language, 'ui', 'unreleased')) + ")"));
          this.info_container.find('p.info-text').html((_ref26 = data.text) != null ? _ref26 : '');
          ship = exportObj.ships[data.ship];
          this.info_container.find('tr.info-ship td.info-data').text(data.ship);
          this.info_container.find('tr.info-ship').show();
          this.info_container.find('tr.info-skill td.info-data').text(data.skill);
          this.info_container.find('tr.info-skill').show();
          this.info_container.find('tr.info-attack td.info-data').text((_ref27 = (_ref28 = data.ship_override) != null ? _ref28.attack : void 0) != null ? _ref27 : ship.attack);
          this.info_container.find('tr.info-attack').toggle((((_ref29 = data.ship_override) != null ? _ref29.attack : void 0) != null) || (ship.attack != null));
          this.info_container.find('tr.info-energy td.info-data').text((_ref30 = (_ref31 = data.ship_override) != null ? _ref31.energy : void 0) != null ? _ref30 : ship.energy);
          this.info_container.find('tr.info-energy').toggle((((_ref32 = data.ship_override) != null ? _ref32.energy : void 0) != null) || (ship.energy != null));
          this.info_container.find('tr.info-range').hide();
          this.info_container.find('tr.info-agility td.info-data').text((_ref33 = (_ref34 = data.ship_override) != null ? _ref34.agility : void 0) != null ? _ref33 : ship.agility);
          this.info_container.find('tr.info-agility').show();
          this.info_container.find('tr.info-hull td.info-data').text((_ref35 = (_ref36 = data.ship_override) != null ? _ref36.hull : void 0) != null ? _ref35 : ship.hull);
          this.info_container.find('tr.info-hull').show();
          this.info_container.find('tr.info-shields td.info-data').text((_ref37 = (_ref38 = data.ship_override) != null ? _ref38.shields : void 0) != null ? _ref37 : ship.shields);
          this.info_container.find('tr.info-shields').show();
          this.info_container.find('tr.info-actions td.info-data').text(((function() {
            var _i, _len, _ref39, _ref40, _ref41, _results;
            _ref41 = (_ref39 = (_ref40 = data.ship_override) != null ? _ref40.actions : void 0) != null ? _ref39 : exportObj.ships[data.ship].actions;
            _results = [];
            for (_i = 0, _len = _ref41.length; _i < _len; _i++) {
              action = _ref41[_i];
              _results.push(exportObj.translate(this.language, 'action', action));
            }
            return _results;
          }).call(this)).join(', '));
          this.info_container.find('tr.info-actions').show();
          this.info_container.find('tr.info-upgrades').show();
          this.info_container.find('tr.info-upgrades td.info-data').text(((function() {
            var _i, _len, _ref39, _results;
            _ref39 = data.slots;
            _results = [];
            for (_i = 0, _len = _ref39.length; _i < _len; _i++) {
              slot = _ref39[_i];
              _results.push(exportObj.translate(this.language, 'slot', slot));
            }
            return _results;
          }).call(this)).join(', ') || 'None');
          this.info_container.find('p.info-maneuvers').show();
          this.info_container.find('p.info-maneuvers').html(this.getManeuverTableHTML(ship.maneuvers, ship.maneuvers));
          break;
        case 'Addon':
          this.info_container.find('.info-sources').text(((function() {
            var _i, _len, _ref39, _results;
            _ref39 = data.sources;
            _results = [];
            for (_i = 0, _len = _ref39.length; _i < _len; _i++) {
              source = _ref39[_i];
              _results.push(exportObj.translate(this.language, 'sources', source));
            }
            return _results;
          }).call(this)).sort().join(', '));
          if (((_ref39 = this.collection) != null ? _ref39.counts : void 0) != null) {
            addon_count = (_ref40 = (_ref41 = this.collection.counts) != null ? (_ref42 = _ref41[additional_opts.addon_type.toLowerCase()]) != null ? _ref42[data.english_name] : void 0 : void 0) != null ? _ref40 : 0;
            this.info_container.find('.info-collection').text("You have " + addon_count + " in your collection.");
          } else {
            this.info_container.find('.info-collection').text('');
          }
          this.info_container.find('.info-name').html("" + (data.unique ? "&middot;&nbsp;" : "") + data.name + (data.limited != null ? " (" + (exportObj.translate(this.language, 'ui', 'limited')) + ")" : "") + (data.epic != null ? " (" + (exportObj.translate(this.language, 'ui', 'epic')) + ")" : "") + (exportObj.isReleased(data) ? "" : " (" + (exportObj.translate(this.language, 'ui', 'unreleased')) + ")"));
          this.info_container.find('p.info-text').html((_ref43 = data.text) != null ? _ref43 : '');
          this.info_container.find('tr.info-ship').hide();
          this.info_container.find('tr.info-skill').hide();
          if (data.energy != null) {
            this.info_container.find('tr.info-energy td.info-data').text(data.energy);
            this.info_container.find('tr.info-energy').show();
          } else {
            this.info_container.find('tr.info-energy').hide();
          }
          if (data.attack != null) {
            this.info_container.find('tr.info-attack td.info-data').text(data.attack);
            this.info_container.find('tr.info-attack').show();
          } else {
            this.info_container.find('tr.info-attack').hide();
          }
          if (data.range != null) {
            this.info_container.find('tr.info-range td.info-data').text(data.range);
            this.info_container.find('tr.info-range').show();
          } else {
            this.info_container.find('tr.info-range').hide();
          }
          this.info_container.find('tr.info-agility').hide();
          this.info_container.find('tr.info-hull').hide();
          this.info_container.find('tr.info-shields').hide();
          this.info_container.find('tr.info-actions').hide();
          this.info_container.find('tr.info-upgrades').hide();
          this.info_container.find('p.info-maneuvers').hide();
      }
      this.info_container.show();
      return this.tooltip_currently_displaying = data;
    }
  };

  SquadBuilder.prototype._randomizerLoopBody = function(data) {
    var addon, available_modifications, available_pilots, available_ships, available_titles, available_upgrades, idx, modification, new_ship, pilot, removable_things, ship, ship_type, thing_to_remove, title, unused_addons, upgrade, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _len5, _m, _n, _ref, _ref1, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7;
    if (data.keep_running && data.iterations < data.max_iterations) {
      data.iterations++;
      if (this.total_points === data.max_points) {
        data.keep_running = false;
      } else if (this.total_points < data.max_points) {
        unused_addons = [];
        _ref = this.ships;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          ship = _ref[_i];
          _ref1 = ship.upgrades;
          for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
            upgrade = _ref1[_j];
            if (upgrade.data == null) {
              unused_addons.push(upgrade);
            }
          }
          if ((ship.title != null) && (ship.title.data == null)) {
            unused_addons.push(ship.title);
          }
          _ref2 = ship.modifications;
          for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
            modification = _ref2[_k];
            if (modification.data == null) {
              unused_addons.push(modification);
            }
          }
        }
        idx = $.randomInt(1 + unused_addons.length);
        if (idx === 0) {
          available_ships = this.getAvailableShipsMatching();
          ship_type = available_ships[$.randomInt(available_ships.length)].text;
          available_pilots = this.getAvailablePilotsForShipIncluding(ship_type);
          pilot = available_pilots[$.randomInt(available_pilots.length)];
          if (exportObj.pilotsById[pilot.id].sources.intersects(data.allowed_sources)) {
            new_ship = this.addShip();
            new_ship.setPilotById(pilot.id);
          }
        } else {
          addon = unused_addons[idx - 1];
          switch (addon.type) {
            case 'Upgrade':
              available_upgrades = (function() {
                var _l, _len3, _ref3, _results;
                _ref3 = this.getAvailableUpgradesIncluding(addon.slot, null, addon.ship);
                _results = [];
                for (_l = 0, _len3 = _ref3.length; _l < _len3; _l++) {
                  upgrade = _ref3[_l];
                  if (exportObj.upgradesById[upgrade.id].sources.intersects(data.allowed_sources)) {
                    _results.push(upgrade);
                  }
                }
                return _results;
              }).call(this);
              if (available_upgrades.length > 0) {
                addon.setById(available_upgrades[$.randomInt(available_upgrades.length)].id);
              }
              break;
            case 'Title':
              available_titles = (function() {
                var _l, _len3, _ref3, _results;
                _ref3 = this.getAvailableTitlesIncluding(addon.ship);
                _results = [];
                for (_l = 0, _len3 = _ref3.length; _l < _len3; _l++) {
                  title = _ref3[_l];
                  if (exportObj.titlesById[title.id].sources.intersects(data.allowed_sources)) {
                    _results.push(title);
                  }
                }
                return _results;
              }).call(this);
              if (available_titles.length > 0) {
                addon.setById(available_titles[$.randomInt(available_titles.length)].id);
              }
              break;
            case 'Modification':
              available_modifications = (function() {
                var _l, _len3, _ref3, _results;
                _ref3 = this.getAvailableModificationsIncluding(null, addon.ship);
                _results = [];
                for (_l = 0, _len3 = _ref3.length; _l < _len3; _l++) {
                  modification = _ref3[_l];
                  if (exportObj.modificationsById[modification.id].sources.intersects(data.allowed_sources)) {
                    _results.push(modification);
                  }
                }
                return _results;
              }).call(this);
              if (available_modifications.length > 0) {
                addon.setById(available_modifications[$.randomInt(available_modifications.length)].id);
              }
              break;
            default:
              throw new Error("Invalid addon type " + addon.type);
          }
        }
      } else {
        removable_things = [];
        _ref3 = this.ships;
        for (_l = 0, _len3 = _ref3.length; _l < _len3; _l++) {
          ship = _ref3[_l];
          removable_things.push(ship);
          _ref4 = ship.upgrades;
          for (_m = 0, _len4 = _ref4.length; _m < _len4; _m++) {
            upgrade = _ref4[_m];
            if (upgrade.data != null) {
              removable_things.push(upgrade);
            }
          }
          if (((_ref5 = ship.title) != null ? _ref5.data : void 0) != null) {
            removable_things.push(ship.title);
          }
          if (((_ref6 = ship.modification) != null ? _ref6.data : void 0) != null) {
            removable_things.push(ship.modification);
          }
        }
        if (removable_things.length > 0) {
          thing_to_remove = removable_things[$.randomInt(removable_things.length)];
          if (thing_to_remove instanceof Ship) {
            this.removeShip(thing_to_remove);
          } else if (thing_to_remove instanceof GenericAddon) {
            thing_to_remove.setData(null);
          } else {
            throw new Error("Unknown thing to remove " + thing_to_remove);
          }
        }
      }
      return window.setTimeout(this._makeRandomizerLoopFunc(data), 0);
    } else {
      window.clearTimeout(data.timer);
      _ref7 = this.ships;
      for (_n = 0, _len5 = _ref7.length; _n < _len5; _n++) {
        ship = _ref7[_n];
        ship.updateSelections();
      }
      this.suppress_automatic_new_ship = false;
      return this.addShip();
    }
  };

  SquadBuilder.prototype._makeRandomizerLoopFunc = function(data) {
    return (function(_this) {
      return function() {
        return _this._randomizerLoopBody(data);
      };
    })(this);
  };

  SquadBuilder.prototype.randomSquad = function(max_points, allowed_sources, timeout_ms, max_iterations) {
    var data, stopHandler;
    if (max_points == null) {
      max_points = 100;
    }
    if (allowed_sources == null) {
      allowed_sources = null;
    }
    if (timeout_ms == null) {
      timeout_ms = 1000;
    }
    if (max_iterations == null) {
      max_iterations = 1000;
    }
    this.backend_status.fadeOut('slow');
    this.suppress_automatic_new_ship = true;
    while (this.ships.length > 0) {
      this.removeShip(this.ships[0]);
    }
    if (this.ships.length > 0) {
      throw new Error("Ships not emptied");
    }
    data = {
      iterations: 0,
      max_points: max_points,
      max_iterations: max_iterations,
      keep_running: true,
      allowed_sources: allowed_sources != null ? allowed_sources : exportObj.expansions
    };
    stopHandler = (function(_this) {
      return function() {
        return data.keep_running = false;
      };
    })(this);
    data.timer = window.setTimeout(stopHandler, timeout_ms);
    window.setTimeout(this._makeRandomizerLoopFunc(data), 0);
    this.resetCurrentSquad();
    this.current_squad.name = 'Random Squad';
    return this.container.trigger('xwing-backend:squadNameChanged');
  };

  SquadBuilder.prototype.setBackend = function(backend) {
    return this.backend = backend;
  };

  SquadBuilder.prototype.describeSquad = function() {
    var ship;
    return ((function() {
      var _i, _len, _ref, _results;
      _ref = this.ships;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        ship = _ref[_i];
        if (ship.pilot != null) {
          _results.push(ship.pilot.name);
        }
      }
      return _results;
    }).call(this)).join(', ');
  };

  SquadBuilder.prototype.listCards = function() {
    var card_obj, ship, upgrade, _i, _j, _len, _len1, _ref, _ref1, _ref2, _ref3;
    card_obj = {};
    _ref = this.ships;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      ship = _ref[_i];
      if (ship.pilot != null) {
        card_obj[ship.pilot.name] = null;
        _ref1 = ship.upgrades;
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          upgrade = _ref1[_j];
          if (upgrade.data != null) {
            card_obj[upgrade.data.name] = null;
          }
        }
        if (((_ref2 = ship.title) != null ? _ref2.data : void 0) != null) {
          card_obj[ship.title.data.name] = null;
        }
        if (((_ref3 = ship.modification) != null ? _ref3.data : void 0) != null) {
          card_obj[ship.modification.data.name] = null;
        }
      }
    }
    return Object.keys(card_obj).sort();
  };

  SquadBuilder.prototype.getNotes = function() {
    return this.notes.val();
  };

  SquadBuilder.prototype.isSquadPossibleWithCollection = function() {
    var modification, modification_is_available, pilot_is_available, ship, ship_is_available, title_is_available, upgrade, upgrade_is_available, validity, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2, _ref3, _ref4, _ref5;
    if (Object.keys((_ref = (_ref1 = this.collection) != null ? _ref1.expansions : void 0) != null ? _ref : {}).length === 0) {
      return true;
    }
    this.collection.reset();
    validity = true;
    _ref2 = this.ships;
    for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
      ship = _ref2[_i];
      if (ship.pilot != null) {
        ship_is_available = this.collection.use('ship', ship.pilot.english_ship);
        pilot_is_available = this.collection.use('pilot', ship.pilot.english_name);
        if (!(ship_is_available && pilot_is_available)) {
          validity = false;
        }
        _ref3 = ship.upgrades;
        for (_j = 0, _len1 = _ref3.length; _j < _len1; _j++) {
          upgrade = _ref3[_j];
          if (upgrade.data != null) {
            upgrade_is_available = this.collection.use('upgrade', upgrade.data.english_name);
            if (!upgrade_is_available) {
              validity = false;
            }
          }
        }
        _ref4 = ship.modifications;
        for (_k = 0, _len2 = _ref4.length; _k < _len2; _k++) {
          modification = _ref4[_k];
          if (modification.data != null) {
            modification_is_available = this.collection.use('modification', modification.data.english_name);
            if (!modification_is_available) {
              validity = false;
            }
          }
        }
        if (((_ref5 = ship.title) != null ? _ref5.data : void 0) != null) {
          title_is_available = this.collection.use('title', ship.title.data.english_name);
          if (!title_is_available) {
            validity = false;
          }
        }
      }
    }
    return validity;
  };

  SquadBuilder.prototype.checkCollection = function() {
    if (this.collection != null) {
      return this.collection_invalid_container.toggleClass('hidden', this.isSquadPossibleWithCollection());
    }
  };

  SquadBuilder.prototype.toXWS = function() {
    var candidate, last_id, match, matches, multisection_id_to_pilots, pilot, ship, unmatched, unmatched_pilot, xws, _, _i, _j, _k, _l, _len, _len1, _len2, _len3, _m, _name, _ref, _ref1, _ref2, _ref3;
    xws = {
      description: this.getNotes(),
      faction: exportObj.toXWSFaction[this.faction],
      name: this.current_squad.name,
      pilots: [],
      points: this.total_points,
      vendor: {
        yasb: {
          builder: '(Yet Another) X-Wing Miniatures Squad Builder',
          builder_url: window.location.href.split('?')[0],
          link: this.permalink.attr('href')
        }
      },
      version: '0.3.0'
    };
    _ref = this.ships;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      ship = _ref[_i];
      if (ship.pilot != null) {
        xws.pilots.push(ship.toXWS());
      }
    }
    multisection_id_to_pilots = {};
    last_id = 0;
    unmatched = (function() {
      var _j, _len1, _ref1, _results;
      _ref1 = xws.pilots;
      _results = [];
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        pilot = _ref1[_j];
        if (pilot.multisection != null) {
          _results.push(pilot);
        }
      }
      return _results;
    })();
    for (_ = _j = 0, _ref1 = Math.pow(unmatched.length, 2); 0 <= _ref1 ? _j < _ref1 : _j > _ref1; _ = 0 <= _ref1 ? ++_j : --_j) {
      if (unmatched.length === 0) {
        break;
      }
      unmatched_pilot = unmatched.shift();
      if (unmatched_pilot.multisection_id == null) {
        unmatched_pilot.multisection_id = last_id++;
      }
      if (multisection_id_to_pilots[_name = unmatched_pilot.multisection_id] == null) {
        multisection_id_to_pilots[_name] = [unmatched_pilot];
      }
      if (unmatched.length === 0) {
        break;
      }
      matches = [];
      for (_k = 0, _len1 = unmatched.length; _k < _len1; _k++) {
        candidate = unmatched[_k];
        if (_ref2 = unmatched_pilot.name, __indexOf.call(candidate.multisection, _ref2) >= 0) {
          matches.push(candidate);
          unmatched_pilot.multisection.removeItem(candidate.name);
          candidate.multisection.removeItem(unmatched_pilot.name);
          candidate.multisection_id = unmatched_pilot.multisection_id;
          multisection_id_to_pilots[candidate.multisection_id].push(candidate);
          if (unmatched_pilot.multisection.length === 0) {
            break;
          }
        }
      }
      for (_l = 0, _len2 = matches.length; _l < _len2; _l++) {
        match = matches[_l];
        if (match.multisection.length === 0) {
          unmatched.removeItem(match);
        }
      }
    }
    _ref3 = xws.pilots;
    for (_m = 0, _len3 = _ref3.length; _m < _len3; _m++) {
      pilot = _ref3[_m];
      if (pilot.multisection != null) {
        delete pilot.multisection;
      }
    }
    return xws;
  };

  SquadBuilder.prototype.toMinimalXWS = function() {
    var k, v, xws, _ref;
    xws = this.toXWS();
    for (k in xws) {
      if (!__hasProp.call(xws, k)) continue;
      v = xws[k];
      if (k !== 'faction' && k !== 'pilots' && k !== 'version') {
        delete xws[k];
      }
    }
    _ref = xws.pilots;
    for (k in _ref) {
      if (!__hasProp.call(_ref, k)) continue;
      v = _ref[k];
      if (k !== 'name' && k !== 'ship' && k !== 'upgrades' && k !== 'multisection_id') {
        delete xws[k];
      }
    }
    return xws;
  };

  SquadBuilder.prototype.loadFromXWS = function(xws, cb) {
    var a, addon, addon_added, addons, err, error, i, modification, new_ship, p, pilot, slot, slot_guesses, success, upgrade, upgrade_canonical, upgrade_canonicals, upgrade_type, version_list, x, xws_faction, yasb_upgrade_type, _, _i, _j, _k, _l, _len, _len1, _len2, _len3, _m, _ref, _ref1, _ref2, _ref3, _ref4, _ref5;
    success = null;
    error = null;
    version_list = (function() {
      var _i, _len, _ref, _results;
      _ref = xws.version.split('.');
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        x = _ref[_i];
        _results.push(parseInt(x));
      }
      return _results;
    })();
    switch (false) {
      case !(version_list > [0, 1]):
        xws_faction = exportObj.fromXWSFaction[xws.faction];
        if (this.faction !== xws_faction) {
          throw new Error("Attempted to load XWS for " + xws.faction + " but builder is " + this.faction);
        }
        if (xws.name != null) {
          this.current_squad.name = xws.name;
        }
        if (xws.description != null) {
          this.notes.val(xws.description);
        }
        this.suppress_automatic_new_ship = true;
        this.removeAllShips();
        _ref = xws.pilots;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          pilot = _ref[_i];
          new_ship = this.addShip();
          try {
            new_ship.setPilot(((function() {
              var _j, _len1, _ref1, _results;
              _ref1 = exportObj.pilotsByFactionCanonicalName[this.faction][pilot.name];
              _results = [];
              for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
                p = _ref1[_j];
                if (p.ship.canonicalize() === pilot.ship) {
                  _results.push(p);
                }
              }
              return _results;
            }).call(this))[0]);
          } catch (_error) {
            err = _error;
            continue;
          }
          addons = [];
          _ref2 = (_ref1 = pilot.upgrades) != null ? _ref1 : {};
          for (upgrade_type in _ref2) {
            upgrade_canonicals = _ref2[upgrade_type];
            for (_j = 0, _len1 = upgrade_canonicals.length; _j < _len1; _j++) {
              upgrade_canonical = upgrade_canonicals[_j];
              slot = null;
              yasb_upgrade_type = (_ref3 = exportObj.fromXWSUpgrade[upgrade_type]) != null ? _ref3 : upgrade_type.capitalize();
              addon = (function() {
                switch (yasb_upgrade_type) {
                  case 'Modification':
                    return exportObj.modificationsByCanonicalName[upgrade_canonical];
                  case 'Title':
                    return exportObj.titlesByCanonicalName[upgrade_canonical];
                  default:
                    slot = yasb_upgrade_type;
                    return exportObj.upgradesBySlotCanonicalName[slot][upgrade_canonical];
                }
              })();
              if (addon != null) {
                addons.push({
                  type: yasb_upgrade_type,
                  data: addon,
                  slot: slot
                });
              }
            }
          }
          if (addons.length > 0) {
            for (_ = _k = 0; _k < 1000; _ = ++_k) {
              addon = addons.shift();
              addon_added = false;
              switch (addon.type) {
                case 'Modification':
                  _ref4 = new_ship.modifications;
                  for (_l = 0, _len2 = _ref4.length; _l < _len2; _l++) {
                    modification = _ref4[_l];
                    if (modification.data != null) {
                      continue;
                    }
                    modification.setData(addon.data);
                    addon_added = true;
                    break;
                  }
                  break;
                case 'Title':
                  if (new_ship.title.data == null) {
                    if (addon.data instanceof Array) {
                      slot_guesses = (function() {
                        var _len3, _m, _ref5, _results;
                        _results = [];
                        for (_m = 0, _len3 = addons.length; _m < _len3; _m++) {
                          a = addons[_m];
                          if ((_ref5 = a.data.slot) === 'Cannon' || _ref5 === 'Missile' || _ref5 === 'Torpedo') {
                            _results.push(a.data.slot);
                          }
                        }
                        return _results;
                      })();
                      if (slot_guesses.length > 0) {
                        new_ship.title.setData(exportObj.titlesByLocalizedName["\"Heavy Scyk\" Interceptor (" + slot_guesses[0] + ")"]);
                      } else {
                        new_ship.title.setData(addon.data[0]);
                      }
                    } else {
                      new_ship.title.setData(addon.data);
                    }
                    addon_added = true;
                  }
                  break;
                default:
                  _ref5 = new_ship.upgrades;
                  for (i = _m = 0, _len3 = _ref5.length; _m < _len3; i = ++_m) {
                    upgrade = _ref5[i];
                    if (upgrade.slot !== addon.slot || (upgrade.data != null)) {
                      continue;
                    }
                    upgrade.setData(addon.data);
                    addon_added = true;
                    break;
                  }
              }
              if (addon_added) {
                if (addons.length === 0) {
                  break;
                }
              } else {
                if (addons.length === 0) {
                  success = false;
                  error = "Could not add " + addon.data.name + " to " + new_ship;
                  break;
                } else {
                  addons.push(addon);
                }
              }
            }
            if (addons.length > 0) {
              success = false;
              error = "Could not add all upgrades";
              break;
            }
          }
        }
        this.suppress_automatic_new_ship = false;
        this.addShip();
        success = true;
        break;
      default:
        success = false;
        error = "Invalid or unsupported XWS version";
    }
    if (success) {
      this.current_squad.dirty = true;
      this.container.trigger('xwing-backend:squadNameChanged');
      this.container.trigger('xwing-backend:squadDirtinessChanged');
    }
    return cb({
      success: success,
      error: error
    });
  };

  return SquadBuilder;

})();

Ship = (function() {
  function Ship(args) {
    this.builder = args.builder;
    this.container = args.container;
    this.pilot = null;
    this.data = null;
    this.upgrades = [];
    this.modifications = [];
    this.title = null;
    this.setupUI();
  }

  Ship.prototype.destroy = function(cb) {
    var idx;
    this.resetPilot();
    this.resetAddons();
    this.teardownUI();
    idx = this.builder.ships.indexOf(this);
    if (idx < 0) {
      throw new Error("Ship not registered with builder");
    }
    this.builder.ships.splice(idx, 1);
    return cb();
  };

  Ship.prototype.copyFrom = function(other) {
    var available_pilots, i, modification, other_conferred_addon, other_conferred_addons, other_modification, other_modifications, other_upgrade, other_upgrades, pilot_data, upgrade, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _len5, _len6, _m, _n, _name, _o, _ref, _ref1, _ref10, _ref11, _ref12, _ref13, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8, _ref9;
    if (other === this) {
      throw new Error("Cannot copy from self");
    }
    if (!((other.pilot != null) && (other.data != null))) {
      return;
    }
    if (other.pilot.unique) {
      available_pilots = (function() {
        var _i, _len, _ref, _results;
        _ref = this.builder.getAvailablePilotsForShipIncluding(other.data.name);
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          pilot_data = _ref[_i];
          if (!pilot_data.disabled) {
            _results.push(pilot_data);
          }
        }
        return _results;
      }).call(this);
      if (available_pilots.length > 0) {
        this.setPilotById(available_pilots[0].id);
        other_upgrades = {};
        _ref = other.upgrades;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          upgrade = _ref[_i];
          if (((upgrade != null ? upgrade.data : void 0) != null) && !upgrade.data.unique) {
            if (other_upgrades[_name = upgrade.slot] == null) {
              other_upgrades[_name] = [];
            }
            other_upgrades[upgrade.slot].push(upgrade);
          }
        }
        other_modifications = [];
        _ref1 = other.modifications;
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          modification = _ref1[_j];
          if (((modification != null ? modification.data : void 0) != null) && !modification.data.unique) {
            other_modifications.push(modification);
          }
        }
        if ((((_ref2 = other.title) != null ? _ref2.data : void 0) != null) && !other.title.data.unique) {
          this.title.setById(other.title.data.id);
        }
        _ref3 = this.modifications;
        for (_k = 0, _len2 = _ref3.length; _k < _len2; _k++) {
          modification = _ref3[_k];
          other_modification = other_modifications.shift();
          if (other_modification != null) {
            modification.setById(other_modification.data.id);
          }
        }
        _ref4 = this.upgrades;
        for (_l = 0, _len3 = _ref4.length; _l < _len3; _l++) {
          upgrade = _ref4[_l];
          other_upgrade = ((_ref5 = other_upgrades[upgrade.slot]) != null ? _ref5 : []).shift();
          if (other_upgrade != null) {
            upgrade.setById(other_upgrade.data.id);
          }
        }
      } else {
        return;
      }
    } else {
      this.setPilotById(other.pilot.id);
      other_conferred_addons = [];
      if ((other.title != null) && other.title.conferredAddons.length > 0) {
        other_conferred_addons = other_conferred_addons.concat(other.title.conferredAddons);
      }
      if (((_ref6 = other.modifications[0]) != null ? _ref6.data : void 0) != null) {
        other_conferred_addons = other_conferred_addons.concat(other.modifications[0].conferredAddons);
      }
      _ref7 = other.upgrades;
      for (i = _m = 0, _len4 = _ref7.length; _m < _len4; i = ++_m) {
        other_upgrade = _ref7[i];
        if ((other_upgrade.data != null) && __indexOf.call(other_conferred_addons, other_upgrade) < 0 && !other_upgrade.data.unique) {
          this.upgrades[i].setById(other_upgrade.data.id);
        }
      }
      if ((((_ref8 = other.title) != null ? _ref8.data : void 0) != null) && !other.title.data.unique) {
        this.title.setById(other.title.data.id);
      }
      if (((_ref9 = other.modifications[0]) != null ? _ref9.data : void 0) && !other.modifications[0].data.unique) {
        this.modifications[0].setById(other.modifications[0].data.id);
      }
      if ((other.title != null) && other.title.conferredAddons.length > 0) {
        _ref10 = other.title.conferredAddons;
        for (i = _n = 0, _len5 = _ref10.length; _n < _len5; i = ++_n) {
          other_conferred_addon = _ref10[i];
          if ((other_conferred_addon.data != null) && !((_ref11 = other_conferred_addon.data) != null ? _ref11.unique : void 0)) {
            this.title.conferredAddons[i].setById(other_conferred_addon.data.id);
          }
        }
      }
      if ((other.modifications[0] != null) && other.modifications[0].conferredAddons.length > 0) {
        _ref12 = other.modifications[0].conferredAddons;
        for (i = _o = 0, _len6 = _ref12.length; _o < _len6; i = ++_o) {
          other_conferred_addon = _ref12[i];
          if ((other_conferred_addon.data != null) && !((_ref13 = other_conferred_addon.data) != null ? _ref13.unique : void 0)) {
            this.modifications[0].conferredAddons[i].setById(other_conferred_addon.data.id);
          }
        }
      }
    }
    this.updateSelections();
    this.builder.container.trigger('xwing:pointsUpdated');
    this.builder.current_squad.dirty = true;
    return this.builder.container.trigger('xwing-backend:squadDirtinessChanged');
  };

  Ship.prototype.setShipType = function(ship_type) {
    var cls, result, _i, _len, _ref, _ref1;
    this.pilot_selector.data('select2').container.show();
    if (ship_type !== ((_ref = this.pilot) != null ? _ref.ship : void 0)) {
      this.setPilot(((function() {
        var _i, _len, _ref1, _results;
        _ref1 = this.builder.getAvailablePilotsForShipIncluding(ship_type);
        _results = [];
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          result = _ref1[_i];
          if (!exportObj.pilotsById[result.id].unique) {
            _results.push(exportObj.pilotsById[result.id]);
          }
        }
        return _results;
      }).call(this))[0]);
    }
    _ref1 = this.row.attr('class').split(/\s+/);
    for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
      cls = _ref1[_i];
      if (cls.indexOf('ship-') === 0) {
        this.row.removeClass(cls);
      }
    }
    this.remove_button.fadeIn('fast');
    this.row.addClass("ship-" + (ship_type.toLowerCase().replace(/[^a-z0-9]/gi, '')) + "0");
    return this.builder.container.trigger('xwing:shipUpdated');
  };

  Ship.prototype.setPilotById = function(id) {
    return this.setPilot(exportObj.pilotsById[parseInt(id)]);
  };

  Ship.prototype.setPilotByName = function(name) {
    return this.setPilot(exportObj.pilotsByLocalizedName[$.trim(name)]);
  };

  Ship.prototype.setPilot = function(new_pilot) {
    var modification, old_modification, old_modifications, old_title, old_upgrade, old_upgrades, same_ship, upgrade, ___iced_passed_deferral, __iced_deferrals, __iced_k, _i, _j, _len, _len1, _name, _ref, _ref1;
    __iced_k = __iced_k_noop;
    ___iced_passed_deferral = iced.findDeferral(arguments);
    if (new_pilot !== this.pilot) {
      same_ship = (this.pilot != null) && (new_pilot != null ? new_pilot.ship : void 0) === this.pilot.ship;
      old_upgrades = {};
      old_title = null;
      old_modifications = [];
      if (same_ship) {
        _ref = this.upgrades;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          upgrade = _ref[_i];
          if ((upgrade != null ? upgrade.data : void 0) != null) {
            if (old_upgrades[_name = upgrade.slot] == null) {
              old_upgrades[_name] = [];
            }
            old_upgrades[upgrade.slot].push(upgrade);
          }
        }
        if (this.title != null) {
          old_title = this.title;
        }
        _ref1 = this.modifications;
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          modification = _ref1[_j];
          if ((modification != null ? modification.data : void 0) != null) {
            old_modifications.push(modification);
          }
        }
      }
      this.resetPilot();
      this.resetAddons();
      (function(_this) {
        return (function(__iced_k) {
          if (new_pilot != null) {
            _this.data = exportObj.ships[new_pilot != null ? new_pilot.ship : void 0];
            (function(__iced_k) {
              if ((new_pilot != null ? new_pilot.unique : void 0) != null) {
                (function(__iced_k) {
                  __iced_deferrals = new iced.Deferrals(__iced_k, {
                    parent: ___iced_passed_deferral,
                    funcname: "Ship.setPilot"
                  });
                  _this.builder.container.trigger('xwing:claimUnique', [
                    new_pilot, 'Pilot', __iced_deferrals.defer({
                      lineno: 18758
                    })
                  ]);
                  __iced_deferrals._fulfill();
                })(__iced_k);
              } else {
                return __iced_k();
              }
            })(function() {
              var _k, _l, _len2, _len3, _ref2, _ref3, _ref4;
              _this.pilot = new_pilot;
              if (_this.pilot != null) {
                _this.setupAddons();
              }
              _this.copy_button.show();
              _this.setShipType(_this.pilot.ship);
              if (same_ship) {
                if ((old_title != null ? old_title.data : void 0) != null) {
                  _this.title.setById(old_title.data.id);
                }
                _ref2 = _this.modifications;
                for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
                  modification = _ref2[_k];
                  old_modification = old_modifications.shift();
                  if (old_modification != null) {
                    modification.setById(old_modification.data.id);
                  }
                }
                _ref3 = _this.upgrades;
                for (_l = 0, _len3 = _ref3.length; _l < _len3; _l++) {
                  upgrade = _ref3[_l];
                  old_upgrade = ((_ref4 = old_upgrades[upgrade.slot]) != null ? _ref4 : []).shift();
                  if (old_upgrade != null) {
                    upgrade.setById(old_upgrade.data.id);
                  }
                }
              }
              return __iced_k();
            });
          } else {
            return __iced_k(_this.copy_button.hide());
          }
        });
      })(this)((function(_this) {
        return function() {
          _this.builder.container.trigger('xwing:pointsUpdated');
          return __iced_k(_this.builder.container.trigger('xwing-backend:squadDirtinessChanged'));
        };
      })(this));
    } else {
      return __iced_k();
    }
  };

  Ship.prototype.resetPilot = function() {
    var ___iced_passed_deferral, __iced_deferrals, __iced_k;
    __iced_k = __iced_k_noop;
    ___iced_passed_deferral = iced.findDeferral(arguments);
    (function(_this) {
      return (function(__iced_k) {
        var _ref;
        if (((_ref = _this.pilot) != null ? _ref.unique : void 0) != null) {
          (function(__iced_k) {
            __iced_deferrals = new iced.Deferrals(__iced_k, {
              parent: ___iced_passed_deferral,
              funcname: "Ship.resetPilot"
            });
            _this.builder.container.trigger('xwing:releaseUnique', [
              _this.pilot, 'Pilot', __iced_deferrals.defer({
                lineno: 18782
              })
            ]);
            __iced_deferrals._fulfill();
          })(__iced_k);
        } else {
          return __iced_k();
        }
      });
    })(this)((function(_this) {
      return function() {
        return _this.pilot = null;
      };
    })(this));
  };

  Ship.prototype.setupAddons = function() {
    var slot, _i, _len, _ref, _ref1;
    _ref1 = (_ref = this.pilot.slots) != null ? _ref : [];
    for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
      slot = _ref1[_i];
      this.upgrades.push(new exportObj.Upgrade({
        ship: this,
        container: this.addon_container,
        slot: slot
      }));
    }
    if (this.pilot.ship in exportObj.titlesByShip) {
      this.title = new exportObj.Title({
        ship: this,
        container: this.addon_container
      });
    }
    return this.modifications.push(new exportObj.Modification({
      ship: this,
      container: this.addon_container
    }));
  };

  Ship.prototype.resetAddons = function() {
    var modification, upgrade, ___iced_passed_deferral, __iced_deferrals, __iced_k;
    __iced_k = __iced_k_noop;
    ___iced_passed_deferral = iced.findDeferral(arguments);
    (function(_this) {
      return (function(__iced_k) {
        var _i, _j, _len, _len1, _ref, _ref1;
        __iced_deferrals = new iced.Deferrals(__iced_k, {
          parent: ___iced_passed_deferral,
          funcname: "Ship.resetAddons"
        });
        if (_this.title != null) {
          _this.title.destroy(__iced_deferrals.defer({
            lineno: 18804
          }));
        }
        _ref = _this.upgrades;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          upgrade = _ref[_i];
          upgrade.destroy(__iced_deferrals.defer({
            lineno: 18806
          }));
        }
        _ref1 = _this.modifications;
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          modification = _ref1[_j];
          if (modification != null) {
            modification.destroy(__iced_deferrals.defer({
              lineno: 18808
            }));
          }
        }
        __iced_deferrals._fulfill();
      });
    })(this)((function(_this) {
      return function() {
        _this.upgrades = [];
        _this.modifications = [];
        return _this.title = null;
      };
    })(this));
  };

  Ship.prototype.getPoints = function() {
    var modification, points, upgrade, _i, _j, _len, _len1, _ref, _ref1, _ref2, _ref3, _ref4, _ref5, _ref6;
    points = ((_ref = (_ref1 = this.pilot) != null ? _ref1.points : void 0) != null ? _ref : 0) + ((_ref2 = (_ref3 = this.title) != null ? _ref3.getPoints() : void 0) != null ? _ref2 : 0);
    _ref4 = this.upgrades;
    for (_i = 0, _len = _ref4.length; _i < _len; _i++) {
      upgrade = _ref4[_i];
      points += upgrade.getPoints();
    }
    _ref5 = this.modifications;
    for (_j = 0, _len1 = _ref5.length; _j < _len1; _j++) {
      modification = _ref5[_j];
      points += (_ref6 = modification != null ? modification.getPoints() : void 0) != null ? _ref6 : 0;
    }
    this.points_container.find('span').text(points);
    if (points > 0) {
      this.points_container.fadeTo('fast', 1);
    } else {
      this.points_container.fadeTo(0, 0);
    }
    return points;
  };

  Ship.prototype.getEpicPoints = function() {
    var _ref, _ref1;
    return (_ref = (_ref1 = this.data) != null ? _ref1.epic_points : void 0) != null ? _ref : 0;
  };

  Ship.prototype.updateSelections = function() {
    var modification, upgrade, _i, _j, _len, _len1, _ref, _ref1, _results;
    if (this.pilot != null) {
      this.ship_selector.select2('data', {
        id: this.pilot.ship,
        text: this.pilot.ship
      });
      this.pilot_selector.select2('data', {
        id: this.pilot.id,
        text: "" + this.pilot.name + " (" + this.pilot.points + ")"
      });
      this.pilot_selector.data('select2').container.show();
      _ref = this.upgrades;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        upgrade = _ref[_i];
        upgrade.updateSelection();
      }
      if (this.title != null) {
        this.title.updateSelection();
      }
      _ref1 = this.modifications;
      _results = [];
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        modification = _ref1[_j];
        if (modification != null) {
          _results.push(modification.updateSelection());
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    } else {
      this.pilot_selector.select2('data', null);
      return this.pilot_selector.data('select2').container.toggle(this.ship_selector.val() !== '');
    }
  };

  Ship.prototype.setupUI = function() {
    this.row = $(document.createElement('DIV'));
    this.row.addClass('row-fluid ship');
    this.row.insertBefore(this.builder.notes_container);
    this.row.append($.trim('<div class="span3">\n    <input class="ship-selector-container" type="hidden" />\n    <br />\n    <input type="hidden" class="pilot-selector-container" />\n</div>\n<div class="span1 points-display-container">\n    <span></span>\n</div>\n<div class="span6 addon-container" />\n<div class="span2 button-container">\n    <button class="btn btn-danger remove-pilot"><span class="visible-desktop visible-tablet hidden-phone" data-toggle="tooltip" title="Remove Pilot"><i class="icon-remove"></i></span><span class="hidden-desktop hidden-tablet visible-phone">Remove Pilot</span></button>\n    <button class="btn copy-pilot"><span class="visible-desktop visible-tablet hidden-phone" data-toggle="tooltip" title="Clone Pilot"><i class="icon-copy"></i></span><span class="hidden-desktop hidden-tablet visible-phone">Clone Pilot</span></button>\n</div>'));
    this.row.find('.button-container span').tooltip();
    this.ship_selector = $(this.row.find('input.ship-selector-container'));
    this.pilot_selector = $(this.row.find('input.pilot-selector-container'));
    this.ship_selector.select2({
      width: '100%',
      placeholder: exportObj.translate(this.builder.language, 'ui', 'shipSelectorPlaceholder'),
      query: (function(_this) {
        return function(query) {
          _this.builder.checkCollection();
          return query.callback({
            more: false,
            results: _this.builder.getAvailableShipsMatching(query.term)
          });
        };
      })(this),
      minimumResultsForSearch: $.isMobile() ? -1 : 0,
      formatResultCssClass: (function(_this) {
        return function(obj) {
          var not_in_collection;
          if (_this.builder.collection != null) {
            not_in_collection = false;
            if ((_this.pilot != null) && obj.id === exportObj.ships[_this.pilot.ship].id) {
              if (!(_this.builder.collection.checkShelf('ship', obj.english_name) || _this.builder.collection.checkTable('pilot', obj.english_name))) {
                not_in_collection = true;
              }
            } else {
              not_in_collection = !_this.builder.collection.checkShelf('ship', obj.english_name);
            }
            if (not_in_collection) {
              return 'select2-result-not-in-collection';
            } else {
              return '';
            }
          } else {
            return '';
          }
        };
      })(this)
    });
    this.ship_selector.on('change', (function(_this) {
      return function(e) {
        return _this.setShipType(_this.ship_selector.val());
      };
    })(this));
    this.row.attr('id', "row-" + (this.ship_selector.data('select2').container.attr('id')));
    this.pilot_selector.select2({
      width: '100%',
      placeholder: exportObj.translate(this.builder.language, 'ui', 'pilotSelectorPlaceholder'),
      query: (function(_this) {
        return function(query) {
          _this.builder.checkCollection();
          return query.callback({
            more: false,
            results: _this.builder.getAvailablePilotsForShipIncluding(_this.ship_selector.val(), _this.pilot, query.term)
          });
        };
      })(this),
      minimumResultsForSearch: $.isMobile() ? -1 : 0,
      formatResultCssClass: (function(_this) {
        return function(obj) {
          var not_in_collection, _ref;
          if (_this.builder.collection != null) {
            not_in_collection = false;
            if (obj.id === ((_ref = _this.pilot) != null ? _ref.id : void 0)) {
              if (!(_this.builder.collection.checkShelf('pilot', obj.english_name) || _this.builder.collection.checkTable('pilot', obj.english_name))) {
                not_in_collection = true;
              }
            } else {
              not_in_collection = !_this.builder.collection.checkShelf('pilot', obj.english_name);
            }
            if (not_in_collection) {
              return 'select2-result-not-in-collection';
            } else {
              return '';
            }
          } else {
            return '';
          }
        };
      })(this)
    });
    this.pilot_selector.on('change', (function(_this) {
      return function(e) {
        _this.setPilotById(_this.pilot_selector.select2('val'));
        _this.builder.current_squad.dirty = true;
        _this.builder.container.trigger('xwing-backend:squadDirtinessChanged');
        return _this.builder.backend_status.fadeOut('slow');
      };
    })(this));
    this.pilot_selector.data('select2').results.on('mousemove-filtered', (function(_this) {
      return function(e) {
        var select2_data, _ref;
        select2_data = $(e.target).closest('.select2-result').data('select2-data');
        if ((select2_data != null ? select2_data.id : void 0) != null) {
          return _this.builder.showTooltip('Pilot', exportObj.pilotsById[select2_data.id], {
            ship: (_ref = _this.data) != null ? _ref.english_name : void 0
          });
        }
      };
    })(this));
    this.pilot_selector.data('select2').container.on('mouseover', (function(_this) {
      return function(e) {
        if (_this.data != null) {
          return _this.builder.showTooltip('Ship', _this);
        }
      };
    })(this));
    this.pilot_selector.data('select2').container.hide();
    this.points_container = $(this.row.find('.points-display-container'));
    this.points_container.fadeTo(0, 0);
    this.addon_container = $(this.row.find('div.addon-container'));
    this.remove_button = $(this.row.find('button.remove-pilot'));
    this.remove_button.click((function(_this) {
      return function(e) {
        e.preventDefault();
        return _this.row.slideUp('fast', function() {
          var _ref;
          _this.builder.removeShip(_this);
          return (_ref = _this.backend_status) != null ? _ref.fadeOut('slow') : void 0;
        });
      };
    })(this));
    this.remove_button.hide();
    this.copy_button = $(this.row.find('button.copy-pilot'));
    this.copy_button.click((function(_this) {
      return function(e) {
        var clone;
        clone = _this.builder.ships[_this.builder.ships.length - 1];
        return clone.copyFrom(_this);
      };
    })(this));
    return this.copy_button.hide();
  };

  Ship.prototype.teardownUI = function() {
    this.row.text('');
    return this.row.remove();
  };

  Ship.prototype.toString = function() {
    if (this.pilot != null) {
      return "Pilot " + this.pilot.name + " flying " + this.data.name;
    } else {
      return "Ship without pilot";
    }
  };

  Ship.prototype.toHTML = function() {
    var action, action_bar, action_icons, attackHTML, effective_stats, energyHTML, html, modification, slotted_upgrades, upgrade, _i, _j, _len, _len1, _ref, _ref1, _ref10, _ref11, _ref12, _ref13, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8, _ref9;
    effective_stats = this.effectiveStats();
    action_icons = [];
    _ref = effective_stats.actions;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      action = _ref[_i];
      action_icons.push((function() {
        switch (action) {
          case 'Focus':
            return "<i class=\"xwing-miniatures-font xwing-miniatures-font-focus\"></i>";
          case 'Evade':
            return "<i class=\"xwing-miniatures-font xwing-miniatures-font-evade\"></i>";
          case 'Barrel Roll':
            return "<i class=\"xwing-miniatures-font xwing-miniatures-font-barrelroll\"></i>";
          case 'Target Lock':
            return "<i class=\"xwing-miniatures-font xwing-miniatures-font-targetlock\"></i>";
          case 'Boost':
            return "<i class=\"xwing-miniatures-font xwing-miniatures-font-boost\"></i>";
          case 'Coordinate':
            return "<i class=\"xwing-miniatures-font xwing-miniatures-font-coordinate\"></i>";
          case 'Jam':
            return "<i class=\"xwing-miniatures-font xwing-miniatures-font-jam\"></i>";
          case 'Recover':
            return "<i class=\"xwing-miniatures-font xwing-miniatures-font-recover\"></i>";
          case 'Reinforce':
            return "<i class=\"xwing-miniatures-font xwing-miniatures-font-reinforce\"></i>";
          case 'Cloak':
            return "<i class=\"xwing-miniatures-font xwing-miniatures-font-cloak\"></i>";
          case 'SLAM':
            return "<i class=\"xwing-miniatures-font xwing-miniatures-font-slam\"></i>";
          default:
            return "<span>&nbsp;" + action + "<span>";
        }
      })());
    }
    action_bar = action_icons.join(' ');
    attackHTML = (((_ref1 = this.pilot.ship_override) != null ? _ref1.attack : void 0) != null) || (this.data.attack != null) ? $.trim("<i class=\"xwing-miniatures-font xwing-miniatures-font-attack\"></i>\n<span class=\"info-data info-attack\">" + (statAndEffectiveStat((_ref2 = (_ref3 = this.pilot.ship_override) != null ? _ref3.attack : void 0) != null ? _ref2 : this.data.attack, effective_stats, 'attack')) + "</span>") : '';
    energyHTML = (((_ref4 = this.pilot.ship_override) != null ? _ref4.energy : void 0) != null) || (this.data.energy != null) ? $.trim("<i class=\"xwing-miniatures-font xwing-miniatures-font-energy\"></i>\n<span class=\"info-data info-energy\">" + (statAndEffectiveStat((_ref5 = (_ref6 = this.pilot.ship_override) != null ? _ref6.energy : void 0) != null ? _ref5 : this.data.energy, effective_stats, 'energy')) + "</span>") : '';
    html = $.trim("<div class=\"fancy-pilot-header\">\n    <div class=\"pilot-header-text\">" + this.pilot.name + " <i class=\"xwing-miniatures-ship xwing-miniatures-ship-" + this.data.canonical_name + "\"></i></div>\n    <div class=\"mask\">\n        <div class=\"outer-circle\">\n            <div class=\"inner-circle pilot-points\">" + this.pilot.points + "</div>\n        </div>\n    </div>\n</div>\n<div class=\"fancy-pilot-stats\">\n    <div class=\"pilot-stats-content\">\n        <span class=\"info-data info-skill\">PS " + (statAndEffectiveStat(this.pilot.skill, effective_stats, 'skill')) + "</span>\n        " + attackHTML + "\n        " + energyHTML + "\n        <i class=\"xwing-miniatures-font xwing-miniatures-font-agility\"></i>\n        <span class=\"info-data info-agility\">" + (statAndEffectiveStat((_ref7 = (_ref8 = this.pilot.ship_override) != null ? _ref8.agility : void 0) != null ? _ref7 : this.data.agility, effective_stats, 'agility')) + "</span>\n        <i class=\"xwing-miniatures-font xwing-miniatures-font-hull\"></i>\n        <span class=\"info-data info-hull\">" + (statAndEffectiveStat((_ref9 = (_ref10 = this.pilot.ship_override) != null ? _ref10.hull : void 0) != null ? _ref9 : this.data.hull, effective_stats, 'hull')) + "</span>\n        <i class=\"xwing-miniatures-font xwing-miniatures-font-shield\"></i>\n        <span class=\"info-data info-shields\">" + (statAndEffectiveStat((_ref11 = (_ref12 = this.pilot.ship_override) != null ? _ref12.shields : void 0) != null ? _ref11 : this.data.shields, effective_stats, 'shields')) + "</span>\n        &nbsp;\n        " + action_bar + "\n    </div>\n</div>");
    if (this.pilot.text) {
      html += $.trim("<div class=\"fancy-pilot-text\">" + this.pilot.text + "</div>");
    }
    slotted_upgrades = ((function() {
      var _j, _len1, _ref13, _results;
      _ref13 = this.upgrades;
      _results = [];
      for (_j = 0, _len1 = _ref13.length; _j < _len1; _j++) {
        upgrade = _ref13[_j];
        if (upgrade.data != null) {
          _results.push(upgrade);
        }
      }
      return _results;
    }).call(this)).concat((function() {
      var _j, _len1, _ref13, _results;
      _ref13 = this.modifications;
      _results = [];
      for (_j = 0, _len1 = _ref13.length; _j < _len1; _j++) {
        modification = _ref13[_j];
        if (modification.data != null) {
          _results.push(modification);
        }
      }
      return _results;
    }).call(this));
    if (((_ref13 = this.title) != null ? _ref13.data : void 0) != null) {
      slotted_upgrades.push(this.title);
    }
    if (slotted_upgrades.length > 0) {
      html += $.trim("<div class=\"fancy-upgrade-container\">");
      for (_j = 0, _len1 = slotted_upgrades.length; _j < _len1; _j++) {
        upgrade = slotted_upgrades[_j];
        html += upgrade.toHTML();
      }
      html += $.trim("</div>");
    }
    html += $.trim("<div class=\"ship-points-total\">\n    <strong>Ship Total: " + (this.getPoints()) + "</strong>\n</div>");
    return "<div class=\"fancy-ship\">" + html + "</div>";
  };

  Ship.prototype.toTableRow = function() {
    var modification, slotted_upgrades, table_html, upgrade, _i, _len, _ref;
    table_html = $.trim("<tr class=\"simple-pilot\">\n    <td class=\"name\">" + this.pilot.name + " &mdash; " + this.data.name + "</td>\n    <td class=\"points\">" + this.pilot.points + "</td>\n</tr>");
    slotted_upgrades = ((function() {
      var _i, _len, _ref, _results;
      _ref = this.upgrades;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        upgrade = _ref[_i];
        if (upgrade.data != null) {
          _results.push(upgrade);
        }
      }
      return _results;
    }).call(this)).concat((function() {
      var _i, _len, _ref, _results;
      _ref = this.modifications;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        modification = _ref[_i];
        if (modification.data != null) {
          _results.push(modification);
        }
      }
      return _results;
    }).call(this));
    if (((_ref = this.title) != null ? _ref.data : void 0) != null) {
      slotted_upgrades.push(this.title);
    }
    if (slotted_upgrades.length > 0) {
      for (_i = 0, _len = slotted_upgrades.length; _i < _len; _i++) {
        upgrade = slotted_upgrades[_i];
        table_html += upgrade.toTableRow();
      }
    }
    table_html += "<tr class=\"simple-ship-total\"><td colspan=\"2\">Ship Total: " + (this.getPoints()) + "</td></tr>";
    table_html += '<tr><td>&nbsp;</td><td></td></tr>';
    return table_html;
  };

  Ship.prototype.toBBCode = function() {
    var bbcode, bbcode_upgrades, modification, slotted_upgrades, upgrade, upgrade_bbcode, _i, _len, _ref;
    bbcode = "[b]" + this.pilot.name + " (" + this.pilot.points + ")[/b]";
    slotted_upgrades = ((function() {
      var _i, _len, _ref, _results;
      _ref = this.upgrades;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        upgrade = _ref[_i];
        if (upgrade.data != null) {
          _results.push(upgrade);
        }
      }
      return _results;
    }).call(this)).concat((function() {
      var _i, _len, _ref, _results;
      _ref = this.modifications;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        modification = _ref[_i];
        if (modification.data != null) {
          _results.push(modification);
        }
      }
      return _results;
    }).call(this));
    if (((_ref = this.title) != null ? _ref.data : void 0) != null) {
      slotted_upgrades.push(this.title);
    }
    if (slotted_upgrades.length > 0) {
      bbcode += "\n";
      bbcode_upgrades = [];
      for (_i = 0, _len = slotted_upgrades.length; _i < _len; _i++) {
        upgrade = slotted_upgrades[_i];
        upgrade_bbcode = upgrade.toBBCode();
        if (upgrade_bbcode != null) {
          bbcode_upgrades.push(upgrade_bbcode);
        }
      }
      bbcode += bbcode_upgrades.join("\n");
    }
    return bbcode;
  };

  Ship.prototype.toSimpleHTML = function() {
    var html, modification, slotted_upgrades, upgrade, upgrade_html, _i, _len, _ref;
    html = "<b>" + this.pilot.name + " (" + this.pilot.points + ")</b><br />";
    slotted_upgrades = ((function() {
      var _i, _len, _ref, _results;
      _ref = this.upgrades;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        upgrade = _ref[_i];
        if (upgrade.data != null) {
          _results.push(upgrade);
        }
      }
      return _results;
    }).call(this)).concat((function() {
      var _i, _len, _ref, _results;
      _ref = this.modifications;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        modification = _ref[_i];
        if (modification.data != null) {
          _results.push(modification);
        }
      }
      return _results;
    }).call(this));
    if (((_ref = this.title) != null ? _ref.data : void 0) != null) {
      slotted_upgrades.push(this.title);
    }
    if (slotted_upgrades.length > 0) {
      for (_i = 0, _len = slotted_upgrades.length; _i < _len; _i++) {
        upgrade = slotted_upgrades[_i];
        upgrade_html = upgrade.toSimpleHTML();
        if (upgrade_html != null) {
          html += upgrade_html;
        }
      }
    }
    return html;
  };

  Ship.prototype.toSerialized = function() {
    var addon, conferred_addons, i, modification, serialized_conferred_addons, upgrade, upgrades, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref10, _ref11, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8, _ref9;
    conferred_addons = (_ref = (_ref1 = this.title) != null ? _ref1.conferredAddons : void 0) != null ? _ref : [];
    _ref2 = this.modifications;
    for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
      modification = _ref2[_i];
      conferred_addons = conferred_addons.concat((_ref3 = modification != null ? modification.conferredAddons : void 0) != null ? _ref3 : []);
    }
    _ref4 = this.upgrades;
    for (_j = 0, _len1 = _ref4.length; _j < _len1; _j++) {
      upgrade = _ref4[_j];
      conferred_addons = conferred_addons.concat((_ref5 = upgrade != null ? upgrade.conferredAddons : void 0) != null ? _ref5 : []);
    }
    upgrades = "" + ((function() {
      var _k, _len2, _ref6, _ref7, _ref8, _results;
      _ref6 = this.upgrades;
      _results = [];
      for (i = _k = 0, _len2 = _ref6.length; _k < _len2; i = ++_k) {
        upgrade = _ref6[i];
        if (__indexOf.call(conferred_addons, upgrade) < 0) {
          _results.push((_ref7 = upgrade != null ? (_ref8 = upgrade.data) != null ? _ref8.id : void 0 : void 0) != null ? _ref7 : -1);
        }
      }
      return _results;
    }).call(this));
    serialized_conferred_addons = [];
    for (_k = 0, _len2 = conferred_addons.length; _k < _len2; _k++) {
      addon = conferred_addons[_k];
      serialized_conferred_addons.push(addon.toSerialized());
    }
    return [this.pilot.id, upgrades, (_ref6 = (_ref7 = this.title) != null ? (_ref8 = _ref7.data) != null ? _ref8.id : void 0 : void 0) != null ? _ref6 : -1, (_ref9 = (_ref10 = this.modifications[0]) != null ? (_ref11 = _ref10.data) != null ? _ref11.id : void 0 : void 0) != null ? _ref9 : -1, serialized_conferred_addons.join(',')].join(':');
  };

  Ship.prototype.fromSerialized = function(version, serialized) {
    var addon_cls, addon_id, addon_type_serialized, conferred_addon, conferredaddon_pair, conferredaddon_pairs, deferred_id, deferred_ids, i, modification, modification_conferred_addon_pairs, modification_id, pilot_id, title_conferred_addon_pairs, title_conferred_upgrade_ids, title_id, upgrade, upgrade_conferred_addon_pairs, upgrade_id, upgrade_ids, _i, _j, _k, _l, _len, _len1, _len10, _len11, _len12, _len13, _len14, _len15, _len2, _len3, _len4, _len5, _len6, _len7, _len8, _len9, _m, _n, _o, _p, _q, _r, _ref, _ref1, _ref10, _ref11, _ref12, _ref13, _ref14, _ref15, _ref16, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8, _ref9, _s, _t, _u, _v, _w, _x;
    switch (version) {
      case 1:
        _ref = serialized.split(':'), pilot_id = _ref[0], upgrade_ids = _ref[1], title_id = _ref[2], title_conferred_upgrade_ids = _ref[3], modification_id = _ref[4];
        this.setPilotById(parseInt(pilot_id));
        _ref1 = upgrade_ids.split(',');
        for (i = _i = 0, _len = _ref1.length; _i < _len; i = ++_i) {
          upgrade_id = _ref1[i];
          upgrade_id = parseInt(upgrade_id);
          if (upgrade_id >= 0) {
            this.upgrades[i].setById(upgrade_id);
          }
        }
        title_id = parseInt(title_id);
        if (title_id >= 0) {
          this.title.setById(title_id);
        }
        if ((this.title != null) && this.title.conferredAddons.length > 0) {
          _ref2 = title_conferred_upgrade_ids.split(',');
          for (i = _j = 0, _len1 = _ref2.length; _j < _len1; i = ++_j) {
            upgrade_id = _ref2[i];
            upgrade_id = parseInt(upgrade_id);
            if (upgrade_id >= 0) {
              this.title.conferredAddons[i].setById(upgrade_id);
            }
          }
        }
        modification_id = parseInt(modification_id);
        if (modification_id >= 0) {
          this.modifications[0].setById(modification_id);
        }
        break;
      case 2:
      case 3:
        _ref3 = serialized.split(':'), pilot_id = _ref3[0], upgrade_ids = _ref3[1], title_id = _ref3[2], modification_id = _ref3[3], conferredaddon_pairs = _ref3[4];
        this.setPilotById(parseInt(pilot_id));
        deferred_ids = [];
        _ref4 = upgrade_ids.split(',');
        for (i = _k = 0, _len2 = _ref4.length; _k < _len2; i = ++_k) {
          upgrade_id = _ref4[i];
          upgrade_id = parseInt(upgrade_id);
          if (upgrade_id < 0 || isNaN(upgrade_id)) {
            continue;
          }
          if (this.upgrades[i].isOccupied()) {
            deferred_ids.push(upgrade_id);
          } else {
            this.upgrades[i].setById(upgrade_id);
          }
        }
        for (_l = 0, _len3 = deferred_ids.length; _l < _len3; _l++) {
          deferred_id = deferred_ids[_l];
          _ref5 = this.upgrades;
          for (i = _m = 0, _len4 = _ref5.length; _m < _len4; i = ++_m) {
            upgrade = _ref5[i];
            if (upgrade.isOccupied() || upgrade.slot !== exportObj.upgradesById[deferred_id].slot) {
              continue;
            }
            upgrade.setById(deferred_id);
            break;
          }
        }
        title_id = parseInt(title_id);
        if (title_id >= 0) {
          this.title.setById(title_id);
        }
        modification_id = parseInt(modification_id);
        if (modification_id >= 0) {
          this.modifications[0].setById(modification_id);
        }
        if (conferredaddon_pairs != null) {
          conferredaddon_pairs = conferredaddon_pairs.split(',');
        } else {
          conferredaddon_pairs = [];
        }
        if ((this.title != null) && this.title.conferredAddons.length > 0) {
          title_conferred_addon_pairs = conferredaddon_pairs.splice(0, this.title.conferredAddons.length);
          for (i = _n = 0, _len5 = title_conferred_addon_pairs.length; _n < _len5; i = ++_n) {
            conferredaddon_pair = title_conferred_addon_pairs[i];
            _ref6 = conferredaddon_pair.split('.'), addon_type_serialized = _ref6[0], addon_id = _ref6[1];
            addon_id = parseInt(addon_id);
            addon_cls = SERIALIZATION_CODE_TO_CLASS[addon_type_serialized];
            conferred_addon = this.title.conferredAddons[i];
            if (conferred_addon instanceof addon_cls) {
              conferred_addon.setById(addon_id);
            } else {
              throw new Error("Expected addon class " + addon_cls.constructor.name + " for conferred addon at index " + i + " but " + conferred_addon.constructor.name + " is there");
            }
          }
        }
        _ref7 = this.modifications;
        for (_o = 0, _len6 = _ref7.length; _o < _len6; _o++) {
          modification = _ref7[_o];
          if (((modification != null ? modification.data : void 0) != null) && modification.conferredAddons.length > 0) {
            modification_conferred_addon_pairs = conferredaddon_pairs.splice(0, modification.conferredAddons.length);
            for (i = _p = 0, _len7 = modification_conferred_addon_pairs.length; _p < _len7; i = ++_p) {
              conferredaddon_pair = modification_conferred_addon_pairs[i];
              _ref8 = conferredaddon_pair.split('.'), addon_type_serialized = _ref8[0], addon_id = _ref8[1];
              addon_id = parseInt(addon_id);
              addon_cls = SERIALIZATION_CODE_TO_CLASS[addon_type_serialized];
              conferred_addon = modification.conferredAddons[i];
              if (conferred_addon instanceof addon_cls) {
                conferred_addon.setById(addon_id);
              } else {
                throw new Error("Expected addon class " + addon_cls.constructor.name + " for conferred addon at index " + i + " but " + conferred_addon.constructor.name + " is there");
              }
            }
          }
        }
        break;
      case 4:
        _ref9 = serialized.split(':'), pilot_id = _ref9[0], upgrade_ids = _ref9[1], title_id = _ref9[2], modification_id = _ref9[3], conferredaddon_pairs = _ref9[4];
        this.setPilotById(parseInt(pilot_id));
        deferred_ids = [];
        _ref10 = upgrade_ids.split(',');
        for (i = _q = 0, _len8 = _ref10.length; _q < _len8; i = ++_q) {
          upgrade_id = _ref10[i];
          upgrade_id = parseInt(upgrade_id);
          if (upgrade_id < 0 || isNaN(upgrade_id)) {
            continue;
          }
          if (this.upgrades[i].isOccupied()) {
            deferred_ids.push(upgrade_id);
          } else {
            this.upgrades[i].setById(upgrade_id);
          }
        }
        for (_r = 0, _len9 = deferred_ids.length; _r < _len9; _r++) {
          deferred_id = deferred_ids[_r];
          _ref11 = this.upgrades;
          for (i = _s = 0, _len10 = _ref11.length; _s < _len10; i = ++_s) {
            upgrade = _ref11[i];
            if (upgrade.isOccupied() || upgrade.slot !== exportObj.upgradesById[deferred_id].slot) {
              continue;
            }
            upgrade.setById(deferred_id);
            break;
          }
        }
        title_id = parseInt(title_id);
        if (title_id >= 0) {
          this.title.setById(title_id);
        }
        modification_id = parseInt(modification_id);
        if (modification_id >= 0) {
          this.modifications[0].setById(modification_id);
        }
        if (conferredaddon_pairs != null) {
          conferredaddon_pairs = conferredaddon_pairs.split(',');
        } else {
          conferredaddon_pairs = [];
        }
        if ((this.title != null) && this.title.conferredAddons.length > 0) {
          title_conferred_addon_pairs = conferredaddon_pairs.splice(0, this.title.conferredAddons.length);
          for (i = _t = 0, _len11 = title_conferred_addon_pairs.length; _t < _len11; i = ++_t) {
            conferredaddon_pair = title_conferred_addon_pairs[i];
            _ref12 = conferredaddon_pair.split('.'), addon_type_serialized = _ref12[0], addon_id = _ref12[1];
            addon_id = parseInt(addon_id);
            addon_cls = SERIALIZATION_CODE_TO_CLASS[addon_type_serialized];
            conferred_addon = this.title.conferredAddons[i];
            if (conferred_addon instanceof addon_cls) {
              conferred_addon.setById(addon_id);
            } else {
              throw new Error("Expected addon class " + addon_cls.constructor.name + " for conferred addon at index " + i + " but " + conferred_addon.constructor.name + " is there");
            }
          }
        }
        _ref13 = this.modifications;
        for (_u = 0, _len12 = _ref13.length; _u < _len12; _u++) {
          modification = _ref13[_u];
          if (((modification != null ? modification.data : void 0) != null) && modification.conferredAddons.length > 0) {
            modification_conferred_addon_pairs = conferredaddon_pairs.splice(0, modification.conferredAddons.length);
            for (i = _v = 0, _len13 = modification_conferred_addon_pairs.length; _v < _len13; i = ++_v) {
              conferredaddon_pair = modification_conferred_addon_pairs[i];
              _ref14 = conferredaddon_pair.split('.'), addon_type_serialized = _ref14[0], addon_id = _ref14[1];
              addon_id = parseInt(addon_id);
              addon_cls = SERIALIZATION_CODE_TO_CLASS[addon_type_serialized];
              conferred_addon = modification.conferredAddons[i];
              if (conferred_addon instanceof addon_cls) {
                conferred_addon.setById(addon_id);
              } else {
                throw new Error("Expected addon class " + addon_cls.constructor.name + " for conferred addon at index " + i + " but " + conferred_addon.constructor.name + " is there");
              }
            }
          }
        }
        _ref15 = this.upgrades;
        for (_w = 0, _len14 = _ref15.length; _w < _len14; _w++) {
          upgrade = _ref15[_w];
          if (((upgrade != null ? upgrade.data : void 0) != null) && upgrade.conferredAddons.length > 0) {
            upgrade_conferred_addon_pairs = conferredaddon_pairs.splice(0, upgrade.conferredAddons.length);
            for (i = _x = 0, _len15 = upgrade_conferred_addon_pairs.length; _x < _len15; i = ++_x) {
              conferredaddon_pair = upgrade_conferred_addon_pairs[i];
              _ref16 = conferredaddon_pair.split('.'), addon_type_serialized = _ref16[0], addon_id = _ref16[1];
              addon_id = parseInt(addon_id);
              addon_cls = SERIALIZATION_CODE_TO_CLASS[addon_type_serialized];
              conferred_addon = upgrade.conferredAddons[i];
              if (conferred_addon instanceof addon_cls) {
                conferred_addon.setById(addon_id);
              } else {
                throw new Error("Expected addon class " + addon_cls.constructor.name + " for conferred addon at index " + i + " but " + conferred_addon.constructor.name + " is there");
              }
            }
          }
        }
    }
    return this.updateSelections();
  };

  Ship.prototype.effectiveStats = function() {
    var modification, s, stats, upgrade, _i, _j, _k, _len, _len1, _ref, _ref1, _ref10, _ref11, _ref12, _ref13, _ref14, _ref15, _ref16, _ref17, _ref18, _ref19, _ref2, _ref20, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8, _ref9;
    stats = {
      skill: this.pilot.skill,
      attack: (_ref = (_ref1 = this.pilot.ship_override) != null ? _ref1.attack : void 0) != null ? _ref : this.data.attack,
      energy: (_ref2 = (_ref3 = this.pilot.ship_override) != null ? _ref3.energy : void 0) != null ? _ref2 : this.data.energy,
      agility: (_ref4 = (_ref5 = this.pilot.ship_override) != null ? _ref5.agility : void 0) != null ? _ref4 : this.data.agility,
      hull: (_ref6 = (_ref7 = this.pilot.ship_override) != null ? _ref7.hull : void 0) != null ? _ref6 : this.data.hull,
      shields: (_ref8 = (_ref9 = this.pilot.ship_override) != null ? _ref9.shields : void 0) != null ? _ref8 : this.data.shields,
      actions: ((_ref10 = (_ref11 = this.pilot.ship_override) != null ? _ref11.actions : void 0) != null ? _ref10 : this.data.actions).slice(0)
    };
    stats.maneuvers = [];
    for (s = _i = 0, _ref12 = ((_ref13 = this.data.maneuvers) != null ? _ref13 : []).length; 0 <= _ref12 ? _i < _ref12 : _i > _ref12; s = 0 <= _ref12 ? ++_i : --_i) {
      stats.maneuvers[s] = this.data.maneuvers[s].slice(0);
    }
    _ref14 = this.upgrades;
    for (_j = 0, _len = _ref14.length; _j < _len; _j++) {
      upgrade = _ref14[_j];
      if ((upgrade != null ? (_ref15 = upgrade.data) != null ? _ref15.modifier_func : void 0 : void 0) != null) {
        upgrade.data.modifier_func(stats);
      }
    }
    if (((_ref16 = this.title) != null ? (_ref17 = _ref16.data) != null ? _ref17.modifier_func : void 0 : void 0) != null) {
      this.title.data.modifier_func(stats);
    }
    _ref18 = this.modifications;
    for (_k = 0, _len1 = _ref18.length; _k < _len1; _k++) {
      modification = _ref18[_k];
      if ((modification != null ? (_ref19 = modification.data) != null ? _ref19.modifier_func : void 0 : void 0) != null) {
        modification.data.modifier_func(stats);
      }
    }
    if (((_ref20 = this.pilot) != null ? _ref20.modifier_func : void 0) != null) {
      this.pilot.modifier_func(stats);
    }
    return stats;
  };

  Ship.prototype.validate = function() {
    var func, i, max_checks, modification, upgrade, valid, _i, _j, _k, _len, _len1, _ref, _ref1, _ref10, _ref11, _ref12, _ref13, _ref14, _ref15, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8, _ref9;
    max_checks = 128;
    for (i = _i = 0; 0 <= max_checks ? _i < max_checks : _i > max_checks; i = 0 <= max_checks ? ++_i : --_i) {
      valid = true;
      _ref = this.upgrades;
      for (_j = 0, _len = _ref.length; _j < _len; _j++) {
        upgrade = _ref[_j];
        func = (_ref1 = (_ref2 = upgrade != null ? (_ref3 = upgrade.data) != null ? _ref3.validation_func : void 0 : void 0) != null ? _ref2 : upgrade != null ? (_ref4 = upgrade.data) != null ? _ref4.restriction_func : void 0 : void 0) != null ? _ref1 : void 0;
        if ((func != null) && !func(this, upgrade)) {
          upgrade.setById(null);
          valid = false;
          break;
        }
      }
      func = (_ref5 = (_ref6 = (_ref7 = this.title) != null ? (_ref8 = _ref7.data) != null ? _ref8.validation_func : void 0 : void 0) != null ? _ref6 : (_ref9 = this.title) != null ? (_ref10 = _ref9.data) != null ? _ref10.restriction_func : void 0 : void 0) != null ? _ref5 : void 0;
      if ((func != null) && !func(this)) {
        this.title.setById(null);
        continue;
      }
      _ref11 = this.modifications;
      for (_k = 0, _len1 = _ref11.length; _k < _len1; _k++) {
        modification = _ref11[_k];
        func = (_ref12 = (_ref13 = modification != null ? (_ref14 = modification.data) != null ? _ref14.validation_func : void 0 : void 0) != null ? _ref13 : modification != null ? (_ref15 = modification.data) != null ? _ref15.restriction_func : void 0 : void 0) != null ? _ref12 : void 0;
        if ((func != null) && !func(this, modification)) {
          modification.setById(null);
          valid = false;
          break;
        }
      }
      if (valid) {
        break;
      }
    }
    return this.updateSelections();
  };

  Ship.prototype.checkUnreleasedContent = function() {
    var modification, upgrade, _i, _j, _len, _len1, _ref, _ref1, _ref2;
    if ((this.pilot != null) && !exportObj.isReleased(this.pilot)) {
      return true;
    }
    if ((((_ref = this.title) != null ? _ref.data : void 0) != null) && !exportObj.isReleased(this.title.data)) {
      return true;
    }
    _ref1 = this.modifications;
    for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
      modification = _ref1[_i];
      if (((modification != null ? modification.data : void 0) != null) && !exportObj.isReleased(modification.data)) {
        return true;
      }
    }
    _ref2 = this.upgrades;
    for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
      upgrade = _ref2[_j];
      if (((upgrade != null ? upgrade.data : void 0) != null) && !exportObj.isReleased(upgrade.data)) {
        return true;
      }
    }
    return false;
  };

  Ship.prototype.checkEpicContent = function() {
    var modification, upgrade, _i, _j, _len, _len1, _ref, _ref1, _ref2, _ref3, _ref4, _ref5;
    if ((this.pilot != null) && (this.pilot.epic != null)) {
      return true;
    }
    if (((_ref = this.title) != null ? (_ref1 = _ref.data) != null ? _ref1.epic : void 0 : void 0) != null) {
      return true;
    }
    _ref2 = this.modifications;
    for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
      modification = _ref2[_i];
      if ((modification != null ? (_ref3 = modification.data) != null ? _ref3.epic : void 0 : void 0) != null) {
        return true;
      }
    }
    _ref4 = this.upgrades;
    for (_j = 0, _len1 = _ref4.length; _j < _len1; _j++) {
      upgrade = _ref4[_j];
      if ((upgrade != null ? (_ref5 = upgrade.data) != null ? _ref5.epic : void 0 : void 0) != null) {
        return true;
      }
    }
    return false;
  };

  Ship.prototype.hasAnotherUnoccupiedSlotLike = function(upgrade_obj) {
    var upgrade, _i, _len, _ref;
    _ref = this.upgrades;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      upgrade = _ref[_i];
      if (upgrade === upgrade_obj || upgrade.slot !== upgrade_obj.slot) {
        continue;
      }
      if (!upgrade.isOccupied()) {
        return true;
      }
    }
    return false;
  };

  Ship.prototype.toXWS = function() {
    var modification, upgrade, upgrade_obj, xws, _i, _j, _len, _len1, _ref, _ref1, _ref2;
    xws = {
      name: this.pilot.canonical_name,
      points: this.getPoints(),
      ship: this.data.canonical_name
    };
    if (this.data.multisection) {
      xws.multisection = this.data.multisection.slice(0);
    }
    upgrade_obj = {};
    _ref = this.upgrades;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      upgrade = _ref[_i];
      if ((upgrade != null ? upgrade.data : void 0) != null) {
        upgrade.toXWS(upgrade_obj);
      }
    }
    _ref1 = this.modifications;
    for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
      modification = _ref1[_j];
      if ((modification != null ? modification.data : void 0) != null) {
        modification.toXWS(upgrade_obj);
      }
    }
    if (((_ref2 = this.title) != null ? _ref2.data : void 0) != null) {
      this.title.toXWS(upgrade_obj);
    }
    if (Object.keys(upgrade_obj).length > 0) {
      xws.upgrades = upgrade_obj;
    }
    return xws;
  };

  return Ship;

})();

GenericAddon = (function() {
  function GenericAddon(args) {
    this.ship = args.ship;
    this.container = $(args.container);
    this.data = null;
    this.unadjusted_data = null;
    this.conferredAddons = [];
    this.serialization_code = 'X';
    this.occupied_by = null;
    this.occupying = [];
    this.type = null;
    this.dataByName = null;
    this.dataById = null;
  }

  GenericAddon.prototype.destroy = function() {
    var args, cb, ___iced_passed_deferral, __iced_deferrals, __iced_k;
    __iced_k = __iced_k_noop;
    ___iced_passed_deferral = iced.findDeferral(arguments);
    cb = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    (function(_this) {
      return (function(__iced_k) {
        var _ref;
        if (((_ref = _this.data) != null ? _ref.unique : void 0) != null) {
          (function(__iced_k) {
            __iced_deferrals = new iced.Deferrals(__iced_k, {
              parent: ___iced_passed_deferral,
              funcname: "GenericAddon.destroy"
            });
            _this.ship.builder.container.trigger('xwing:releaseUnique', [
              _this.data, _this.type, __iced_deferrals.defer({
                lineno: 19440
              })
            ]);
            __iced_deferrals._fulfill();
          })(__iced_k);
        } else {
          return __iced_k();
        }
      });
    })(this)((function(_this) {
      return function() {
        _this.deoccupyOtherUpgrades();
        _this.selector.select2('destroy');
        return cb(args);
      };
    })(this));
  };

  GenericAddon.prototype.setupSelector = function(args) {
    this.selector = $(document.createElement('INPUT'));
    this.selector.attr('type', 'hidden');
    this.container.append(this.selector);
    if ($.isMobile()) {
      args.minimumResultsForSearch = -1;
    }
    args.formatResultCssClass = (function(_this) {
      return function(obj) {
        var not_in_collection, _ref;
        if (_this.ship.builder.collection != null) {
          not_in_collection = false;
          if (obj.id === ((_ref = _this.data) != null ? _ref.id : void 0)) {
            if (!(_this.ship.builder.collection.checkShelf(_this.type.toLowerCase(), obj.english_name) || _this.ship.builder.collection.checkTable(_this.type.toLowerCase(), obj.english_name))) {
              not_in_collection = true;
            }
          } else {
            not_in_collection = !_this.ship.builder.collection.checkShelf(_this.type.toLowerCase(), obj.english_name);
          }
          if (not_in_collection) {
            return 'select2-result-not-in-collection';
          } else {
            return '';
          }
        } else {
          return '';
        }
      };
    })(this);
    args.formatSelection = (function(_this) {
      return function(obj, container) {
        var icon;
        icon = (function() {
          switch (this.type) {
            case 'Upgrade':
              return this.slot.toLowerCase().replace(/[^0-9a-z]/gi, '');
            default:
              return this.type.toLowerCase().replace(/[^0-9a-z]/gi, '');
          }
        }).call(_this);
        $(container).append("<i class=\"xwing-miniatures-font xwing-miniatures-font-" + icon + "\"></i> " + obj.text);
        return void 0;
      };
    })(this);
    this.selector.select2(args);
    this.selector.on('change', (function(_this) {
      return function(e) {
        _this.setById(_this.selector.select2('val'));
        _this.ship.builder.current_squad.dirty = true;
        _this.ship.builder.container.trigger('xwing-backend:squadDirtinessChanged');
        return _this.ship.builder.backend_status.fadeOut('slow');
      };
    })(this));
    this.selector.data('select2').results.on('mousemove-filtered', (function(_this) {
      return function(e) {
        var select2_data;
        select2_data = $(e.target).closest('.select2-result').data('select2-data');
        if ((select2_data != null ? select2_data.id : void 0) != null) {
          return _this.ship.builder.showTooltip('Addon', _this.dataById[select2_data.id], {
            addon_type: _this.type
          });
        }
      };
    })(this));
    return this.selector.data('select2').container.on('mouseover', (function(_this) {
      return function(e) {
        if (_this.data != null) {
          return _this.ship.builder.showTooltip('Addon', _this.data, {
            addon_type: _this.type
          });
        }
      };
    })(this));
  };

  GenericAddon.prototype.setById = function(id) {
    return this.setData(this.dataById[parseInt(id)]);
  };

  GenericAddon.prototype.setByName = function(name) {
    return this.setData(this.dataByName[$.trim(name)]);
  };

  GenericAddon.prototype.setData = function(new_data) {
    var ___iced_passed_deferral, __iced_deferrals, __iced_k, _ref;
    __iced_k = __iced_k_noop;
    ___iced_passed_deferral = iced.findDeferral(arguments);
    if ((new_data != null ? new_data.id : void 0) !== ((_ref = this.data) != null ? _ref.id : void 0)) {
      (function(_this) {
        return (function(__iced_k) {
          var _ref1;
          if (((_ref1 = _this.data) != null ? _ref1.unique : void 0) != null) {
            (function(__iced_k) {
              __iced_deferrals = new iced.Deferrals(__iced_k, {
                parent: ___iced_passed_deferral,
                funcname: "GenericAddon.setData"
              });
              _this.ship.builder.container.trigger('xwing:releaseUnique', [
                _this.unadjusted_data, _this.type, __iced_deferrals.defer({
                  lineno: 19497
                })
              ]);
              __iced_deferrals._fulfill();
            })(__iced_k);
          } else {
            return __iced_k();
          }
        });
      })(this)((function(_this) {
        return function() {
          _this.rescindAddons();
          _this.deoccupyOtherUpgrades();
          (function(__iced_k) {
            if ((new_data != null ? new_data.unique : void 0) != null) {
              (function(__iced_k) {
                __iced_deferrals = new iced.Deferrals(__iced_k, {
                  parent: ___iced_passed_deferral,
                  funcname: "GenericAddon.setData"
                });
                _this.ship.builder.container.trigger('xwing:claimUnique', [
                  new_data, _this.type, __iced_deferrals.defer({
                    lineno: 19501
                  })
                ]);
                __iced_deferrals._fulfill();
              })(__iced_k);
            } else {
              return __iced_k();
            }
          })(function() {
            _this.data = _this.unadjusted_data = new_data;
            if (_this.data != null) {
              if (_this.adjustment_func != null) {
                _this.data = _this.adjustment_func(_this.data);
              }
              _this.unequipOtherUpgrades();
              _this.occupyOtherUpgrades();
              _this.conferAddons();
            } else {
              _this.deoccupyOtherUpgrades();
            }
            return __iced_k(_this.ship.builder.container.trigger('xwing:pointsUpdated'));
          });
        };
      })(this));
    } else {
      return __iced_k();
    }
  };

  GenericAddon.prototype.conferAddons = function() {
    var addon, args, cls, _i, _len, _ref, _results;
    if ((this.data.confersAddons != null) && this.data.confersAddons.length > 0) {
      _ref = this.data.confersAddons;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        addon = _ref[_i];
        cls = addon.type;
        args = {
          ship: this.ship,
          container: this.container
        };
        if (addon.slot != null) {
          args.slot = addon.slot;
        }
        if (addon.adjustment_func != null) {
          args.adjustment_func = addon.adjustment_func;
        }
        if (addon.filter_func != null) {
          args.filter_func = addon.filter_func;
        }
        if (addon.auto_equip != null) {
          args.auto_equip = addon.auto_equip;
        }
        addon = new cls(args);
        if (addon instanceof exportObj.Upgrade) {
          this.ship.upgrades.push(addon);
        } else if (addon instanceof exportObj.Modification) {
          this.ship.modifications.push(addon);
        } else {
          throw new Error("Unexpected addon type for addon " + addon);
        }
        _results.push(this.conferredAddons.push(addon));
      }
      return _results;
    }
  };

  GenericAddon.prototype.rescindAddons = function() {
    var addon, ___iced_passed_deferral, __iced_deferrals, __iced_k;
    __iced_k = __iced_k_noop;
    ___iced_passed_deferral = iced.findDeferral(arguments);
    (function(_this) {
      return (function(__iced_k) {
        var _i, _len, _ref;
        __iced_deferrals = new iced.Deferrals(__iced_k, {
          parent: ___iced_passed_deferral,
          funcname: "GenericAddon.rescindAddons"
        });
        _ref = _this.conferredAddons;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          addon = _ref[_i];
          addon.destroy(__iced_deferrals.defer({
            lineno: 19539
          }));
        }
        __iced_deferrals._fulfill();
      });
    })(this)((function(_this) {
      return function() {
        var _i, _len, _ref;
        _ref = _this.conferredAddons;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          addon = _ref[_i];
          if (addon instanceof exportObj.Upgrade) {
            _this.ship.upgrades.removeItem(addon);
          } else if (addon instanceof exportObj.Modification) {
            _this.ship.modifications.removeItem(addon);
          } else {
            throw new Error("Unexpected addon type for addon " + addon);
          }
        }
        return _this.conferredAddons = [];
      };
    })(this));
  };

  GenericAddon.prototype.getPoints = function() {
    var _ref, _ref1;
    return (_ref = (_ref1 = this.data) != null ? _ref1.points : void 0) != null ? _ref : 0;
  };

  GenericAddon.prototype.updateSelection = function() {
    if (this.data != null) {
      return this.selector.select2('data', {
        id: this.data.id,
        text: "" + this.data.name + " (" + this.data.points + ")"
      });
    } else {
      return this.selector.select2('data', null);
    }
  };

  GenericAddon.prototype.toString = function() {
    if (this.data != null) {
      return "" + this.data.name + " (" + this.data.points + ")";
    } else {
      return "No " + this.type;
    }
  };

  GenericAddon.prototype.toHTML = function() {
    var attackHTML, upgrade_slot_font, _ref;
    if (this.data != null) {
      upgrade_slot_font = ((_ref = this.data.slot) != null ? _ref : this.type).toLowerCase().replace(/[^0-9a-z]/gi, '');
      attackHTML = (this.data.attack != null) ? $.trim("<div class=\"upgrade-attack\">\n    <span class=\"upgrade-attack-range\">" + this.data.range + "</span>\n    <span class=\"info-data info-attack\">" + this.data.attack + "</span>\n    <i class=\"xwing-miniatures-font xwing-miniatures-font-attack\"></i>\n</div>") : '';
      return $.trim("<div class=\"upgrade-container\">\n    <div class=\"upgrade-stats\">\n        <div class=\"upgrade-name\"><i class=\"xwing-miniatures-font xwing-miniatures-font-" + upgrade_slot_font + "\"></i> " + this.data.name + "</div>\n        <div class=\"mask\">\n            <div class=\"outer-circle\">\n                <div class=\"inner-circle upgrade-points\">" + this.data.points + "</div>\n            </div>\n        </div>\n        " + attackHTML + "\n    </div>\n    <div class=\"upgrade-text\">" + this.data.text + "</div>\n    <div style=\"clear: both;\"></div>\n</div>");
    } else {
      return '';
    }
  };

  GenericAddon.prototype.toTableRow = function() {
    if (this.data != null) {
      return $.trim("<tr class=\"simple-addon\">\n    <td class=\"name\">" + this.data.name + "</td>\n    <td class=\"points\">" + this.data.points + "</td>\n</tr>");
    } else {
      return '';
    }
  };

  GenericAddon.prototype.toBBCode = function() {
    if (this.data != null) {
      return "[i]" + this.data.name + " (" + this.data.points + ")[/i]";
    } else {
      return null;
    }
  };

  GenericAddon.prototype.toSimpleHTML = function() {
    if (this.data != null) {
      return "<i>" + this.data.name + " (" + this.data.points + ")</i><br />";
    } else {
      return '';
    }
  };

  GenericAddon.prototype.toSerialized = function() {
    var _ref, _ref1;
    return "" + this.serialization_code + "." + ((_ref = (_ref1 = this.data) != null ? _ref1.id : void 0) != null ? _ref : -1);
  };

  GenericAddon.prototype.unequipOtherUpgrades = function() {
    var slot, upgrade, _i, _len, _ref, _ref1, _ref2, _results;
    _ref2 = (_ref = (_ref1 = this.data) != null ? _ref1.unequips_upgrades : void 0) != null ? _ref : [];
    _results = [];
    for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
      slot = _ref2[_i];
      _results.push((function() {
        var _j, _len1, _ref3, _results1;
        _ref3 = this.ship.upgrades;
        _results1 = [];
        for (_j = 0, _len1 = _ref3.length; _j < _len1; _j++) {
          upgrade = _ref3[_j];
          if (upgrade.slot !== slot || upgrade === this || !upgrade.isOccupied()) {
            continue;
          }
          upgrade.setData(null);
          break;
        }
        return _results1;
      }).call(this));
    }
    return _results;
  };

  GenericAddon.prototype.isOccupied = function() {
    return (this.data != null) || (this.occupied_by != null);
  };

  GenericAddon.prototype.occupyOtherUpgrades = function() {
    var slot, upgrade, _i, _len, _ref, _ref1, _ref2, _results;
    _ref2 = (_ref = (_ref1 = this.data) != null ? _ref1.also_occupies_upgrades : void 0) != null ? _ref : [];
    _results = [];
    for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
      slot = _ref2[_i];
      _results.push((function() {
        var _j, _len1, _ref3, _results1;
        _ref3 = this.ship.upgrades;
        _results1 = [];
        for (_j = 0, _len1 = _ref3.length; _j < _len1; _j++) {
          upgrade = _ref3[_j];
          if (upgrade.slot !== slot || upgrade === this || upgrade.isOccupied()) {
            continue;
          }
          this.occupy(upgrade);
          break;
        }
        return _results1;
      }).call(this));
    }
    return _results;
  };

  GenericAddon.prototype.deoccupyOtherUpgrades = function() {
    var upgrade, _i, _len, _ref, _results;
    _ref = this.occupying;
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      upgrade = _ref[_i];
      _results.push(this.deoccupy(upgrade));
    }
    return _results;
  };

  GenericAddon.prototype.occupy = function(upgrade) {
    upgrade.occupied_by = this;
    upgrade.selector.select2('enable', false);
    return this.occupying.push(upgrade);
  };

  GenericAddon.prototype.deoccupy = function(upgrade) {
    upgrade.occupied_by = null;
    return upgrade.selector.select2('enable', true);
  };

  GenericAddon.prototype.occupiesAnotherUpgradeSlot = function() {
    var upgrade, _i, _len, _ref;
    _ref = this.ship.upgrades;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      upgrade = _ref[_i];
      if (upgrade.slot !== this.slot || upgrade === this || (upgrade.data != null)) {
        continue;
      }
      if ((upgrade.occupied_by != null) && upgrade.occupied_by === this) {
        return true;
      }
    }
    return false;
  };

  GenericAddon.prototype.toXWS = function(upgrade_dict) {
    var upgrade_type;
    upgrade_type = (function() {
      var _ref, _ref1;
      switch (this.type) {
        case 'Upgrade':
          return (_ref = exportObj.toXWSUpgrade[this.slot]) != null ? _ref : this.slot.canonicalize();
        default:
          return (_ref1 = exportObj.toXWSUpgrade[this.type]) != null ? _ref1 : this.type.canonicalize();
      }
    }).call(this);
    return (upgrade_dict[upgrade_type] != null ? upgrade_dict[upgrade_type] : upgrade_dict[upgrade_type] = []).push(this.data.canonical_name);
  };

  return GenericAddon;

})();

exportObj.Upgrade = (function(_super) {
  __extends(Upgrade, _super);

  function Upgrade(args) {
    Upgrade.__super__.constructor.call(this, args);
    this.slot = args.slot;
    this.type = 'Upgrade';
    this.dataById = exportObj.upgradesById;
    this.dataByName = exportObj.upgradesByLocalizedName;
    this.serialization_code = 'U';
    if (args.adjustment_func != null) {
      this.adjustment_func = args.adjustment_func;
    }
    if (args.filter_func != null) {
      this.filter_func = args.filter_func;
    }
    this.setupSelector();
  }

  Upgrade.prototype.setupSelector = function() {
    return Upgrade.__super__.setupSelector.call(this, {
      width: '50%',
      placeholder: exportObj.translate(this.ship.builder.language, 'ui', 'upgradePlaceholder', this.slot),
      allowClear: true,
      query: (function(_this) {
        return function(query) {
          _this.ship.builder.checkCollection();
          return query.callback({
            more: false,
            results: _this.ship.builder.getAvailableUpgradesIncluding(_this.slot, _this.data, _this.ship, _this, query.term, _this.filter_func)
          });
        };
      })(this)
    });
  };

  return Upgrade;

})(GenericAddon);

exportObj.Modification = (function(_super) {
  __extends(Modification, _super);

  function Modification(args) {
    Modification.__super__.constructor.call(this, args);
    this.type = 'Modification';
    this.dataById = exportObj.modificationsById;
    this.dataByName = exportObj.modificationsByLocalizedName;
    this.serialization_code = 'M';
    this.setupSelector();
  }

  Modification.prototype.setupSelector = function() {
    return Modification.__super__.setupSelector.call(this, {
      width: '50%',
      placeholder: exportObj.translate(this.ship.builder.language, 'ui', 'modificationPlaceholder'),
      allowClear: true,
      query: (function(_this) {
        return function(query) {
          _this.ship.builder.checkCollection();
          return query.callback({
            more: false,
            results: _this.ship.builder.getAvailableModificationsIncluding(_this.data, _this.ship, query.term)
          });
        };
      })(this)
    });
  };

  return Modification;

})(GenericAddon);

exportObj.Title = (function(_super) {
  __extends(Title, _super);

  function Title(args) {
    Title.__super__.constructor.call(this, args);
    this.type = 'Title';
    this.dataById = exportObj.titlesById;
    this.dataByName = exportObj.titlesByLocalizedName;
    this.serialization_code = 'T';
    this.setupSelector();
  }

  Title.prototype.setupSelector = function() {
    return Title.__super__.setupSelector.call(this, {
      width: '50%',
      placeholder: exportObj.translate(this.ship.builder.language, 'ui', 'titlePlaceholder'),
      allowClear: true,
      query: (function(_this) {
        return function(query) {
          _this.ship.builder.checkCollection();
          return query.callback({
            more: false,
            results: _this.ship.builder.getAvailableTitlesIncluding(_this.ship, _this.data, query.term)
          });
        };
      })(this)
    });
  };

  return Title;

})(GenericAddon);

exportObj.RestrictedUpgrade = (function(_super) {
  __extends(RestrictedUpgrade, _super);

  function RestrictedUpgrade(args) {
    this.filter_func = args.filter_func;
    RestrictedUpgrade.__super__.constructor.call(this, args);
    this.serialization_code = 'u';
    if (args.auto_equip != null) {
      this.setById(args.auto_equip);
    }
  }

  return RestrictedUpgrade;

})(exportObj.Upgrade);

SERIALIZATION_CODE_TO_CLASS = {
  'M': exportObj.Modification,
  'T': exportObj.Title,
  'U': exportObj.Upgrade,
  'u': exportObj.RestrictedUpgrade
};

exportObj = typeof exports !== "undefined" && exports !== null ? exports : this;

exportObj.fromXWSFaction = {
  'rebel': 'Rebel Alliance',
  'rebels': 'Rebel Alliance',
  'empire': 'Galactic Empire',
  'imperial': 'Galactic Empire',
  'scum': 'Scum and Villainy'
};

exportObj.toXWSFaction = {
  'Rebel Alliance': 'rebel',
  'Galactic Empire': 'imperial',
  'Scum and Villainy': 'scum'
};

exportObj.toXWSUpgrade = {
  'Astromech': 'amd',
  'Elite': 'ept',
  'Modification': 'mod',
  'Salvaged Astromech': 'samd'
};

exportObj.fromXWSUpgrade = {
  'amd': 'Astromech',
  'astromechdroid': 'Astromech',
  'ept': 'Elite',
  'elitepilottalent': 'Elite',
  'mod': 'Modification',
  'samd': 'Salvaged Astromech'
};

SPEC_URL = 'https://github.com/elistevens/xws-spec';

exportObj.XWSManager = (function() {
  function XWSManager(args) {
    this.container = $(args.container);
    this.setupUI();
    this.setupHandlers();
  }

  XWSManager.prototype.setupUI = function() {
    this.container.addClass('hidden-print');
    this.container.html($.trim("<div class=\"row-fluid\">\n    <div class=\"span9\">\n        <button class=\"btn btn-primary from-xws\">Import from XWS (beta)</button>\n        <button class=\"btn btn-primary to-xws\">Export to XWS (beta)</button>\n    </div>\n</div>"));
    this.xws_export_modal = $(document.createElement('DIV'));
    this.xws_export_modal.addClass('modal hide fade xws-modal hidden-print');
    this.container.append(this.xws_export_modal);
    this.xws_export_modal.append($.trim("<div class=\"modal-header\">\n    <button type=\"button\" class=\"close hidden-print\" data-dismiss=\"modal\" aria-hidden=\"true\">&times;</button>\n    <h3>XWS Export (Beta!)</h3>\n</div>\n<div class=\"modal-body\">\n    <ul class=\"nav nav-pills\">\n        <li><a id=\"xws-text-tab\" href=\"#xws-text\" data-toggle=\"tab\">Text</a></li>\n        <li><a id=\"xws-qrcode-tab\" href=\"#xws-qrcode\" data-toggle=\"tab\">QR Code</a></li>\n    </ul>\n    <div class=\"tab-content\">\n        <div class=\"tab-pane\" id=\"xws-text\">\n            Copy and paste this into an XWS-compliant application to transfer your list.\n            <i>(This is in beta, and the <a href=\"" + SPEC_URL + "\">spec</a> is still being defined, so it may not work!)</i>\n            <div class=\"container-fluid\">\n                <textarea class=\"xws-content\"></textarea>\n            </div>\n        </div>\n        <div class=\"tab-pane\" id=\"xws-qrcode\">\n            Below is a QR Code of XWS.  <i>This is still very experimental!</i>\n            <div id=\"xws-qrcode-container\"></div>\n        </div>\n    </div>\n</div>\n<div class=\"modal-footer hidden-print\">\n    <button class=\"btn\" data-dismiss=\"modal\" aria-hidden=\"true\">Close</button>\n</div>"));
    this.xws_import_modal = $(document.createElement('DIV'));
    this.xws_import_modal.addClass('modal hide fade xws-modal hidden-print');
    this.container.append(this.xws_import_modal);
    return this.xws_import_modal.append($.trim("<div class=\"modal-header\">\n    <button type=\"button\" class=\"close hidden-print\" data-dismiss=\"modal\" aria-hidden=\"true\">&times;</button>\n    <h3>XWS Import (Beta!)</h3>\n</div>\n<div class=\"modal-body\">\n    Paste XWS here to load a list exported from another application.\n    <i>(This is in beta, and the <a href=\"" + SPEC_URL + "\">spec</a> is still being defined, so it may not work!)</i>\n    <div class=\"container-fluid\">\n        <textarea class=\"xws-content\" placeholder=\"Paste XWS here...\"></textarea>\n    </div>\n</div>\n<div class=\"modal-footer hidden-print\">\n    <span class=\"xws-import-status\"></span>&nbsp;\n    <button class=\"btn btn-primary import-xws\">Import It!</button>\n    <button class=\"btn\" data-dismiss=\"modal\" aria-hidden=\"true\">Close</button>\n</div>"));
  };

  XWSManager.prototype.setupHandlers = function() {
    this.from_xws_button = this.container.find('button.from-xws');
    this.from_xws_button.click((function(_this) {
      return function(e) {
        e.preventDefault();
        return _this.xws_import_modal.modal('show');
      };
    })(this));
    this.to_xws_button = this.container.find('button.to-xws');
    this.to_xws_button.click((function(_this) {
      return function(e) {
        e.preventDefault();
        return $(window).trigger('xwing:pingActiveBuilder', function(builder) {
          var textarea;
          textarea = $(_this.xws_export_modal.find('.xws-content'));
          textarea.attr('readonly');
          textarea.val(JSON.stringify(builder.toXWS()));
          $('#xws-qrcode-container').text('');
          $('#xws-qrcode-container').qrcode({
            render: 'canvas',
            text: JSON.stringify(builder.toMinimalXWS()),
            ec: 'L',
            size: 256
          });
          _this.xws_export_modal.modal('show');
          $('#xws-text-tab').tab('show');
          textarea.select();
          return textarea.focus();
        });
      };
    })(this));
    $('#xws-qrcode-container').click(function(e) {
      return window.open($('#xws-qrcode-container canvas')[0].toDataURL());
    });
    this.load_xws_button = $(this.xws_import_modal.find('button.import-xws'));
    return this.load_xws_button.click((function(_this) {
      return function(e) {
        var import_status;
        e.preventDefault();
        import_status = $(_this.xws_import_modal.find('.xws-import-status'));
        import_status.text('Loading...');
        return (function(import_status) {
          var xws;
          try {
            xws = JSON.parse(_this.xws_import_modal.find('.xws-content').val());
          } catch (_error) {
            e = _error;
            import_status.text('Invalid JSON');
            return;
          }
          return (function(xws) {
            return $(window).trigger('xwing:activateBuilder', [
              exportObj.fromXWSFaction[xws.faction], function(builder) {
                if (builder.current_squad.dirty && (builder.backend != null)) {
                  _this.xws_import_modal.modal('hide');
                  return builder.backend.warnUnsaved(builder, function() {
                    return builder.loadFromXWS(xws, function(res) {
                      if (!res.success) {
                        _this.xws_import_modal.modal('show');
                        return import_status.text(res.error);
                      }
                    });
                  });
                } else {
                  return builder.loadFromXWS(xws, function(res) {
                    if (res.success) {
                      return _this.xws_import_modal.modal('hide');
                    } else {
                      return import_status.text(res.error);
                    }
                  });
                }
              }
            ]);
          })(xws);
        })(import_status);
      };
    })(this));
  };

  return XWSManager;

})();

/*
//@ sourceMappingURL=xwing.js.map
*/