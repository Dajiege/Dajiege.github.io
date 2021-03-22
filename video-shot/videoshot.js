(function(exports) {
    function renderDom(str) {
        var _div = document.createElement('div');
        _div.innerHTML = str;
        var dom_temp = _div.childNodes;
        for (var i = 0; i < dom_temp.length; i++) {
            if (dom_temp[i].nodeType === 1) {
                return dom_temp[i];
            }
        }
        return; 
    }

    function eachNode(rootNode, callback) {
        var nodes;
        if (!callback) {
            nodes = [];
            eachNode(rootNode, function(node) {
                nodes.push(node);
            });
            return nodes;
        }
    
        if (false === callback(rootNode))
            return false;
    
        if (rootNode.hasChildNodes()) {
            nodes = rootNode.childNodes;
            for (var i = 0, l = nodes.length; i < l; ++i)
                if (false === eachNode(nodes[i], callback))
                    return;
        }
    }
    
    Node.prototype.getNodeById = function(id) {
        var _node = null;
        eachNode(this, function(node) {
            if (node.id === id) {
                _node = node;
                return false;
            }
        });
        return _node;
    };

    function getDataWithRange(x, min, max) {
        if (x < min)
            return min;
        if (x > max)
            return max;
        return x;
    }

    function formatTime(value) {
        var timeArr = value.toString().split('.');
        var miliSecond = (timeArr[1] || '0') + '000';
        var second = '0' + (timeArr[0] % 60).toString();
        var minute = '0' + Math.floor(timeArr[0] / 60).toString();
        return minute.slice(minute.length - 2) + ':' + second.slice(second.length - 2) + '.' + miliSecond.slice(0, 3);
    }

    function VideoShot(config) {
        var that = this;
        this.el = config.el;
        this.url = config.url;
        this.callback = null || config.callback;
        // 背景
        this.bgWrap = renderDom('<div class="bg-wrap"></div>');
        // 弹窗
        this.modalNode = renderDom('<div class="modal-wrap">\
            <div id="J_priview_wrap" class="img-priview-wrap">\
                <video id="J_video" src="' + this.url + '" autoplay preload mute crossorigin="anonymous"></video>\
                <canvas id="J_select" class="select-wrap"></canvas>\
            </div>\
            <div class="selector" id="J_controller_bar">\
                <div class="cur" id="J_controller"></div>\
            </div>\
            <div class="bottom-wrap">\
                <p class="cur-position">当前位置：<span id="J_current">00:00.000 </span>/ <span id="J_duration">00:00.000</span></p>\
                <div id="J_shot" class="shot-btn">截取封面</div>\
            </div>\
        </div>');

        // 视频Node
        this.JVideo = this.modalNode.getNodeById('J_video');
        // 控制条
        this.JControllerBar = this.modalNode.getNodeById('J_controller_bar');
        // 控制按钮
        this.JController = this.modalNode.getNodeById('J_controller');
        // 当前时间
        this.JCurrent = this.modalNode.getNodeById('J_current');
        // 视频总时长
        this.JDuration = this.modalNode.getNodeById('J_duration');
        // 封面选区
        this.JSelect = this.modalNode.getNodeById('J_select');
        // 截图按钮
        this.JShot = this.modalNode.getNodeById('J_shot');
        // 控制条宽度
        this.JControllerBarLength = 0;
        // 控制条左边距
        this.JControllerBarOffsetLeft = 0;
        // 控制按钮的宽度
        this.JControllerWidth = 0;
        // 是否在拖动控制按钮
        this.isGrabbing = false;
        // 是否移动截图区域
        this.isMovingSelectRange = false;
        // 截图区域信息
        this.selectRange = {};
        // 截图区域移动偏移量
        this.movingData = {};
        // 截图的url
        this.img = '';

        // 视频总时长
        Object.defineProperty(this, 'duration', {
            get: function() {
                return this.JDuration.dataset.time;
            },
            set: function(value) {
                this.JDuration.dataset.time = value;
                this.JDuration.innerText = formatTime(value);
            }
        });

        // 当前的时间
        Object.defineProperty(this, 'currentTime', {
            get: function() {
                return this.JCurrent.dataset.time;
            },
            set: function(value) {
                this.JCurrent.dataset.time = value;
                this.JCurrent.innerText = formatTime(value);
            }
        });
        

        // 是否正在上传中
        (function(isUploading) {
            Object.defineProperty(that, 'isUploading', {
                get: function() {
                    return isUploading;
                },
                set: function(value) {
                    isUploading = value;
                    that.JShot.innerText = value ? '上传中...' : '截取封面';
                }
            });
        }(false));
        
        this.JVideo.addEventListener('durationchange', function() {
            that.duration = that.JVideo.duration;
        });

        // 设置相关数据
        this.setDomData = function() {
            var barData = this.JControllerBar.getBoundingClientRect();
            var btnData = this.JController.getBoundingClientRect();
            this.JControllerBarLength = barData.width;
            this.JControllerBarOffsetLeft = barData.x;
            this.JControllerWidth = btnData.width;
        };

        this.getInitRangeInfo = function() {
            var videoData = this.JVideo.getBoundingClientRect();
            this.selectRange.outWidth = videoData.width;
            this.selectRange.outHeight = videoData.height;
            if (videoData.width > videoData.height) {
                // 横向
                this.selectRange.type = 'horizontal';
                this.selectRange.width = videoData.height * 4 / 3;
                this.selectRange.height = videoData.height;
                this.selectRange.x = (videoData.width - this.selectRange.width) / 2;
                this.selectRange.y = 0;
            } else {
                // 竖向
                this.selectRange.type = 'vertical';
                this.selectRange.width = videoData.width;
                this.selectRange.height = videoData.width * 4 / 3;
                this.selectRange.x = 0;
                this.selectRange.y = (videoData.height - this.selectRange.height) / 2;
            }
        };

        this.calcSelectRangeXY = function(offsetX, offsetY) {
            var x, y;
            if (this.selectRange.type === 'horizontal') {
                x = getDataWithRange(this.selectRange.x + offsetX, 0, this.selectRange.outWidth - this.selectRange.width);
                y = this.selectRange.y;
            } else {
                x = this.selectRange.x;
                y = getDataWithRange(this.selectRange.y + offsetY, 0, this.selectRange.outHeight - this.selectRange.height);
            }
            return [x, y];
        };

        this.drawSelectRange = function(offsetX, offsetY) {
            var posi = this.calcSelectRangeXY(offsetX, offsetY);
            var ctx = this.JSelect.getContext('2d');
            ctx.clearRect(0, 0, this.selectRange.outWidth, this.selectRange.outHeight );
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, 0, this.selectRange.outWidth, this.selectRange.outHeight );
            ctx.fillStyle = 'transparent';
            ctx.clearRect(posi[0], posi[1], this.selectRange.width, this.selectRange.height );
            ctx.strokeStyle = '#fff';
            ctx.strokeRect(posi[0], posi[1], this.selectRange.width, this.selectRange.height);
        };

        // 初始化截图选区
        this.initSelectRange = function() {
            this.JSelect.width = this.selectRange.outWidth;
            this.JSelect.height = this.selectRange.outHeight;
            this.drawSelectRange(0, 0);
        };

        // 打开弹窗
        this.openModal = function() {
            document.body.style.overflow = 'hidden';
            document.body.appendChild(that.bgWrap);
            document.body.appendChild(that.modalNode);
            that.setDomData();
            that.getInitRangeInfo();
            that.initSelectRange();
        };

        // 关闭弹窗
        this.closeModal = function() {
            document.body.removeChild(that.bgWrap);
            document.body.removeChild(that.modalNode);
            document.body.style.overflow = '';
        };

        // 点击控制条事件
        this.controllerBarClickHandle = function(e) {
            var x = e.clientX;
            var posi = getDataWithRange(x - this.JControllerBarOffsetLeft, 0, this.JControllerBarLength);
            var persent = posi / this.JControllerBarLength;
            this.currentTime = this.JVideo.currentTime = Math.floor(this.duration * persent * 1000) / 1000;
            this.JController.style.transform = 'translateX(' + (posi - this.JControllerWidth / 2) + 'px)';
        };

        this.screenShot = function() {
            that.isUploading = true;
            var canvas = document.createElement('canvas');
            var radio = this.JVideo.videoWidth / this.selectRange.outWidth;
            canvas.width = this.selectRange.width * radio;
            canvas.height = this.selectRange.height * radio;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(this.JVideo, this.selectRange.x * radio, this.selectRange.y * radio, this.selectRange.width * radio, this.selectRange.height * radio, 0, 0, this.selectRange.width * radio, this.selectRange.height * radio );
            canvas.toBlob(function(blob) {
                if (that.callback) {
                    that.callback(blob);
                }
                that.isUploading = false;
                that.closeModal();
            }, 'image/jpeg');
        };
        
        // 点击事件
        function bindClickEvent(e) {
            if (e.target === this.el) {
                this.openModal();
                return;
            }
            if (e.target === this.bgWrap) {
                this.closeModal();
                return;
            }
            if (e.target === this.JControllerBar) {
                this.controllerBarClickHandle(e);
                return;
            }
            if (e.target === this.JShot && !this.isUploading) {
                this.screenShot();
                return; 
            }
        }

        // 鼠标按下事件
        function mouseDownHandle(e) {
            if (e.target === this.JController) {
                document.body.style.cursor = 'grabbing';
                this.JController.style.cursor = 'grabbing';
                this.isGrabbing = true;
                return; 
            }
            if (e.target === this.JSelect) {
                this.isMovingSelectRange = true;
                this.movingData.startX = e.clientX;
                this.movingData.startY = e.clientY;
                return; 
            }

        }

        // 鼠标移动事件
        function mouseMoveHandle(e) {
            if (this.isGrabbing) {
                this.controllerBarClickHandle(e);
                return;
            }
            if (this.isMovingSelectRange) {
                this.drawSelectRange(e.clientX - this.movingData.startX, e.clientY - this.movingData.startY);
                return; 
            }
        }

        // 鼠标抬起事件
        function mouseUpHandle(e) {
            if (this.isGrabbing) {
                document.body.style.cursor = '';
                this.JController.style.cursor = 'grab';
                this.isGrabbing = false;
            }
            if (this.isMovingSelectRange) {
                this.isMovingSelectRange = false;
                var posi = this.calcSelectRangeXY(e.clientX - this.movingData.startX, e.clientY - this.movingData.startY);
                this.selectRange.x = posi[0];
                this.selectRange.y = posi[1];
                this.movingData = {};
            }
        }

        // 绑定事件
        document.body.addEventListener('click', bindClickEvent.bind(this));
        document.body.addEventListener('mousedown', mouseDownHandle.bind(this));
        document.body.addEventListener('mousemove', mouseMoveHandle.bind(this));
        document.body.addEventListener('mouseup', mouseUpHandle.bind(this));
    }
    exports.VideoShot = VideoShot;
})(window);
