/*

    Backend:
        1 - Exemplo de retorno:
            public ActionResult Search(string query)
            {
                return Json(null, JsonRequestBehavior.AllowGet);
            }

        2 - Para o correto funcionamento do componente, é necessário que o DTO tenha ao menos duas propriedades:

            public string Value {get; set;}
            public string Label {get; set;}

    Frontend:
        1 - Os seguintes métodos podem ser sobrescritos conforme necessidade:
    
        //Monta o template referente ao item que será exibido na listagem do combo
        item: function (obj) {
            return [
                "<span> (Listagem) </span>",
                "<span>" + obj.Label + "</span>",
                "<span >" + obj.Sigla + "</span>" --> Uso de outras propriedades
            ];
        }

        //Como deverá ser exibido o item selecionado
        text: function (obj) {
            return "(Selecionado) " + obj.Label;
        },

        //Ao selecionar o objeto
        on_select: function (obj) {
            alert(obj.Value + ':' + obj.Label);
        },

        //Ao desmarcar (remover) o objeto
        on_deselect: function (obj) {
            alert(obj.Value + ':' + obj.Label);
        }

 */
(function ($, window, document) {

    var pluginName = "snowcomplete2";

    $.fn[pluginName] = function (options) {
        var args = arguments;

        if (options == undefined || typeof options == 'object') {

            return this.each(function () {
                if (!$.data(this, 'plugin_' + pluginName)) {
                    $.data(this, 'plugin_' + pluginName, new SnowComplete2(this, options));
                }
            });

        } else if (typeof options == 'string' && options[0] !== '_' && options !== 'init') {
            if (Array.prototype.slice.call(args, 1).length == 0 && $.inArray(options, $.fn[pluginName].getters) != -1) {
                var instance = $.data(this[0], 'plugin_' + pluginName);
                return instance[options].apply(instance, Array.prototype.slice.call(args, 1));
            } else {
                return this.each(function () {
                    var instance = $.data(this, 'plugin_' + pluginName);
                    if (instance instanceof SnowComplete2 && typeof instance[options] == 'function') {
                        instance[options].apply(instance, Array.prototype.slice.call(args, 1));
                    }
                });
            }
        }
    };

    $.fn[pluginName].defaults = {
        remote: "?Query=%QUERY",
        placeholder: "Digite para procurar",
        ko: undefined,
        query_length: 3,
        limit: 100,
        item: function (obj) { return [ this.text(obj) ]; },
        text: function (obj) { return obj.Label; },
        value: function (obj) { return obj.Value; },
        on_select: function (obj) { },
        on_deselect: function (obj) { },
        item_template: "<li><a href='javascript: void(0);'>__item__</a></li>"
    };

    $.fn[pluginName].getters = [];

    var keyCodes = {
        BACKSPACE: 8, COMMA: 188, DELETE: 46, DOWN: 40, END: 35, ENTER: 13, ESCAPE: 27, HOME: 36, LEFT: 37, PAGE_DOWN: 34, PAGE_UP: 33, PERIOD: 190, RIGHT: 39, SPACE: 32, TAB: 9, UP: 38, SHIFT: 16
    };

    var clearButton = "<button style='position: absolute; top: 30px; right: 20px; z-index: 999;' type='button' class='btn __btnsize__ btn-info'>Remover</button>";
    var loadingIcon = "<div style='width: 24px; position: absolute; top: 30px; right: 20px;'><i class='fa fa-spinner fa-pulse fa-fw'></i></div>";

    function SnowComplete2(element, options) {
        this.el = element;
        this.$el = $(element);
        this.options = $.extend({}, $.fn[pluginName].defaults, options);
        this.has_value = function () {
            var value = this.$el.val();
            return value != undefined && value !== 0 && value !== "";
        };
        this.init();
    }

    SnowComplete2.prototype = {
        init: function () {
            var self = this;
            self.name = this.$el.attr("name");
            self.cancelFocus = true;
            self.searching = false;
            self.typing = false;
            self.menuIndex = 0;
            self.selected = false;
            self.readonly = self.$el.attr("readonly") === "readonly";
            self.original_background = self.$el.css("background");
            self.ajaxpool = null;

            // $this
            self.$el.attr("name", "search__name__".replace(/__name__/, self.name));
            self.$el.attr("autocomplete", "off");
            self.$el.attr("placeholder", self.options.placeholder);


            // $hidden
            self.$hidden = $(document.createElement("input"))
                .attr("type", "hidden")
                .attr("name", self.name)
                .attr("id", "id___name___value".replace(/__name__/, self.name))
                .insertBefore(self.$el);

            // Remover
            self.$clearButton = $(self.get_clearbutton_template());
            self.$clearButton.insertAfter(self.$el);
            self.hide_clearbutton();

            // Loading
            self.$loadingIcon = $(self.get_loadingicon_template());
            self.$loadingIcon.insertAfter(self.$el);
            self.hide_loading();

            self.$clearButton.on('click', function() {
                self.cancel_item();
            });

            if (self.readonly) {
            	self.$clearButton.attr("disabled", "disabled");
            }

            self.closeDropdown = function () {
                self.dropdown_close();
                self.dropdown_clear();
            };

            self.cancelRequest = function () {
                if (self.ajaxpool !== null) {
                    self.ajaxpool.abort();
                    self.ajaxpool = null;
                }
            };

            self.stopSearch = function () {
                self.hide_loading();
                self.closeDropdown();
                self.searching = false;
                self.cancelRequest();                
            };

            self.type = function () {
                if (self.selected)
                    return;

                self.stopSearch();

                self.typing = true;
                clearTimeout(self.typingTimeout);
                self.typingTimeout = setTimeout(function () {
                    self.typing = false;
                    self._search();
                }, 500);
            };

            // GET
            self.$get = function (value, callback) {
                var parametroPrefixo = 'data-snowcomplete-';
                self.cancelRequest();
                
                var concatParams = '';

                $.each(this.$el[0].attributes, function () {
                    if (this.specified && this.name.startsWith(parametroPrefixo)) {
                        concatParams += "&" +this.name.substr(parametroPrefixo.length) + "=" + encodeURI(this.value);
                    }
                });

                var url = self.options.remote.replace(/%QUERY/, encodeURI(value)) + concatParams + "&Limit=__limit__".replace(/__limit__/, self.options.limit);

                self.ajaxpool = $.get(url, callback);
            };

            // Recarrega o valor quando for edição, e já houver valor
            self.reload = function (reloadValue) {
                self.$hidden.val(reloadValue);
                self.$get(reloadValue, function (response) {

                    for (var idx in response) {
                        var obj = response[idx];
                        var v = self.options.value(obj);
                        if (v == reloadValue) {
                            self.select_item(obj);
                        }
                    }
                });
            };

            var originalValue = self.$el.val();

            self.$el.val("");

            if (originalValue != undefined && originalValue !== 0) {
                self.reload(originalValue);
            };

            // Faz o bind, quando utilizar KnockoutJS
            if (self.options.ko != undefined && self.options.ko.bind != undefined) {
                self.$hidden.attr("data-bind", self.options.ko.bind);
            }

            // Cria o Dropdown
            self.$divDropdown = $(document.createElement("div")).insertAfter(self.$el);
            self.$divDropdown.addClass("dropdown");

            self.$menu = $(document.createElement("ul")).appendTo(self.$divDropdown);
            self.$menu.addClass("dropdown-menu");
            self.$menu.css("overflow-y", "scroll");	
            self.$menu.css("max-height", "250px");

            self.$menu.mousedown(function (e) {
                e.preventDefault();

                if (self.cancelFocus) {
                    self.cancelFocus = false;
                    return;
                }
            });

            self.$el.keydown(function (e) {

                if (self.readonly) {
                    e.preventDefault();
                    return;
                }

                switch (e.keyCode) {
                case keyCodes.DOWN:
                    self.key_down(e);
                    break;

                case keyCodes.UP:
                    self.key_up(e);
                    break;

                case keyCodes.ENTER:
                    self.key_enter(e);
                    break;

                case keyCodes.LEFT:
                    e.preventDefault();
                    break;

                case keyCodes.RIGHT:
                    e.preventDefault();
                    break;

                case keyCodes.ESCAPE:
                    self.key_escape(e);
                    break;

                case keyCodes.BACKSPACE:
                        self.key_backspace(e);
                        self.type();
                    break;

                case keyCodes.DELETE:
                        self.key_delete(e);
                        self.type();
                    break;

                case keyCodes.TAB:
                    self.key_tab(e);
                    break;

                case keyCodes.SHIFT:
                    break;

                default:
                    if (self.selected) {
                        e.preventDefault();
                    }
                    self.type();
                    break;
                }
            });

            self.$el.keypress(function (e) {
            });

            self.$el.blur(function (e) {
                if (self.cancelFocus) {
                    e.preventDefault();
                    self.cancelFocus = false;
                    return;
                } else {
                    self.dropdown_close();
                }
            });

            self.$el.focus(function (e) {
                if (!self.selected && self.has_value()) {
                    self.dropdown_open();
                }
            });

            self.$el.on('paste', function (e) {
                if (!self.selected && self.has_value()) {
                    self._search();
                }
            });

            // HTML 5
            self.$el.on('input', function (e) {
                if (!self.selected && self.has_value()) {
                    self._search();
                }

                if (!self.has_value()) {
                    self.key_delete(e);
                }
            });

        },
        get_clearbutton_template: function(){

            var size = 'btn-xs';

            if (this.$el.hasClass("input-lg"))
            {
                size = "";
            }

            return clearButton.replace(/__btnsize__/, size);
        },
        get_loadingicon_template: function () {
            return loadingIcon;
        },
        key_tab: function (e) {
            if (this.has_value()) {
                this.select_item(this.objects[this.menuIndex]);
                this.dropdown_close();
                this.cancelFocus = false;
            }
        },
        key_delete: function (e) {
            if (!this.has_value()) {
                this.cancel_item();
            }
        },
        key_backspace: function (e) {
            if (this.selected) {
                this.dropdown_clear();
                this.cancel_item();
            }
        },
        key_escape: function (e) {
            this.dropdown_close();
            this.cancel_item();
        },
        key_enter: function (e) {
            e.preventDefault();
            this.select_item(this.objects[this.menuIndex]);
        },
        key_up: function (e) {
            this.menu_index_decr();
            this.highlight_item();
        },
        key_down: function (e) {
            this.menu_index_incr();
            this.highlight_item();
        },
        _search: function () {
            var self = this;
            if (!this.searching && !this.typing) {                
                setTimeout(function () { self.search() }, 200);
            }
        },
        menu_children: function(){
        	return this.$menu.children();
        },
        menu_index_decr: function() {
        	if (this.menuIndex > 0)
        		this.menuIndex--;
        },
        menu_index_incr: function() {
        	var length = this.menu_children().length;

        	if (this.menuIndex < (length - 1))
        		this.menuIndex++;
        },
        search: function () {
            var self = this;

            if (self.has_value() && !self.typing) {
                var value = this.$el.val();
                self.dropdown_clear();
                this.searching = true;
                self.show_loading();
                self.$get(value, function (response) {
                    
                    self.objects = response.slice(0, self.options.limit);

                    for (var obj in self.objects) {

                        if (obj !== undefined) {
                            var item = self.create_item(self.objects[obj], value);
                            var itemMenu = $(item).appendTo(self.$menu);

                            itemMenu.attr("data-index", obj);
                            itemMenu.click(function (e) {
                                var idx = $(this).attr("data-index");
                                self.menuIndex = idx;
                                var _obj = self.objects[self.menuIndex];
                                self.select_item(_obj);
                            });
                        }

                    }

                    self.dropdown_open();
                    self.highlight_item();
                    self.searching = false;
                    self.hide_loading();
                });
            } else {
                self.dropdown_close();
                self.dropdown_clear();
            }
        },
        dropdown_open: function () {
            this.$divDropdown.addClass("open");
        },
        dropdown_close: function () {
            this.$divDropdown.removeClass("open");
        },
        dropdown_clear: function () {
            this.objects = [];
            this.$menu.empty();
            this.menuIndex = 0;
        },
        highlight_text: function (s, term) {
            var pattern = new RegExp('(>[^<.]*)(' + term + ')([^<.]*)', 'gi');
            var replaceWith = '$1<strong>$2</strong>$3';
            return s.replace(pattern, replaceWith);
        },
        create_item: function (obj, t) {

            var content = this.options.text(obj);

            if (this.options.item != undefined) {
                var spans = [];
                var parts = this.options.item(obj);
                for (var p in parts) {
                    spans.push(this.highlight_text(parts[p], t));
                }
                content = spans.join("");
            }

            return this.options.item_template.replace(/__item__/, content);
        },
        update_scroll_menu: function($child) {
        	this.$menu.scrollTop(this.$menu.scrollTop() + $child.position().top);
        },
        get_active_item: function() {
        	return this.menu_children().find('.active').first();
        },
        highlight_item: function () {
            var childs = this.menu_children();
            childs.removeClass("active");
            var child = childs.get(this.menuIndex);

            if (child != undefined) {
            	var $child = $(child);
                $child.addClass("active");
                this.update_scroll_menu($child);
            }
        },
        select_item: function (obj) {

            if (obj != undefined) {
                this.$hidden.val(this.options.value(obj));
                this.$el.val(this.options.text(obj));
                this.dropdown_close();
                this.selected = true;
                this.$hidden.change();
                this.dropdown_close();
                this.options.on_select(obj);
                this.$el.css("background", "#e1eef2");
                this.show_clearbutton();
            }
        },
        cancel_item: function () {
            this.$el.val("");
            this.$hidden.val("");
            this.selected = false;
            this.menuIndex = 0;
            this.options.on_deselect();
            this.$el.css("background", this.original_background);
            this.hide_clearbutton();
        },
        show_clearbutton: function(){
            this.$clearButton.show();
        },
        hide_clearbutton: function(){
            this.$clearButton.hide();
        },
        show_loading: function () {
            this.$loadingIcon.show();
        },
        hide_loading: function () {
            this.$loadingIcon.hide();
        },
        destroy: function () {
            this.cancel_item();
            this.$hidden.remove();
            this.$divDropdown.remove();
            this.$el.attr('name', this.name);
            this.$el.removeData('plugin_' + pluginName);
        }
    };

})(jQuery, window, document);
