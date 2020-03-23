// 配置
		var ws_hostname = 'wss://m.sakuya.pw:2020/wss';
		
		// 初始化变量
		var websocket;
		var lrcObj = {};
		var ws_connected = false;
		var last_lrc;
		var next_lrc;
		var rotate = 0;
		var paused = false;
		var openedEmoji = false;
		var lastVol = 0;
		var last_input = "";
		var inputGroupCss = "position: fixed;width:100%;bottom: 0px;left: 0px;padding-bottom:12px;padding-left: 12px;padding-right:12px;background:rgba(39,50,56,0.85);box-shadow: 0px 0px 8px rgba(0,0,0,0.5);";
		
		// 搜索功能
		function checkInput() {
			var userInput = $("#msginput").val();
			userInput = userInput.replace(/点歌 /g, "");
			if(userInput != "") {
				search.src = "search.php?s=" + encodeURIComponent(userInput);
				setTimeout("$(search).fadeIn();", 500);
				openedEmoji = true;
			}
		}
		
		// 暂停音乐
		function setPause() {
			if(paused) {
				musicControl.volume = lastVol;
				paused = false;
			} else {
				lastVol = musicControl.volume;
				musicControl.volume = 0;
				paused = true;
			}
		}
		
		// 关闭窗口
		function checkElement(event) {
			if(openedEmoji && event.target != faces && event.target != openfaces && event.target != search && event.target != opensearch) {
				$(faces).fadeOut();
				$(search).fadeOut();
				openedEmoji = false;
			}
		}
		
		// 系统消息
		function print(msg) {
			$("#chatdata").append("<center><span class='sysmsg'>" + msg + "</span></center>");
			chatdata.scrollTop = chatdata.scrollHeight;
		}
		
		// 解析 Lrc 格式歌词
		function parseLyric(text) {
			var lyrics = text.split("\n");
			var lrcObj = {};
			for(var i=0;i<lyrics.length;i++){
				var lyric = decodeURIComponent(lyrics[i]);
				var timeReg = /\[\d*:\d*((\.|\:)\d*)*\]/g;
				var timeRegExpArr = lyric.match(timeReg);
				if(!timeRegExpArr)continue;
				var clause = lyric.replace(timeReg,'');
				for(var k = 0,h = timeRegExpArr.length;k < h;k++) {
					var t = timeRegExpArr[k];
					var min = Number(String(t.match(/\[\d*/i)).slice(1)),
					sec = Number(String(t.match(/\:\d*/i)).slice(1));
					var time = min * 60 + sec;
					lrcObj[time] = clause;
				}
			}
			return lrcObj;
		}
		
		// 聊天内容
		function chat(data) {
			//var regexp = new RegExp(/#([0-9]{1,2}).(jpg|png|gif)#/g);
			//data.data = data.data.replace(regexp, "<img src='/face/$1.$2' />");
			if (data.data.substr(0,5) == "@img "){
				data.data = "<img src='" + data.data.substring(5) +"' />";
			}
			if (data.data.substr(0,4) == "@img"){
				data.data = "<img src='" + data.data.substring(4) +"' />";
			}
			var randid = Math.floor(Math.random() * 10000000);
			$("#chatdata").append("<div class='chat chat-" + randid + " hidechat'><div class='msgbox'><small class='name'>" + data.user + "</small><div class='msg' title='" + data.time + "'>" + data.data + "</div></div></div>");
			$(".chat-" + randid).fadeIn();
			chatdata.scrollTop = chatdata.scrollHeight;
		}
		
		// 读取音乐
		function music(data) {
			let music_title = data.artists + " - " + data.name;
			let setVolume = localStorage.getItem("volume");
			musicControl.volume = (setVolume == null || setVolume == undefined) ? 1 : setVolume;
			// 原本 pull request 这里加了个通知后面考虑还是去掉了，因为会多次显示刷屏
			document.title = music_title + " - SyncMusic - 在线点歌";
			musicControl.src = data.file;
			musicControl.pause();
			musicname.innerHTML = music_title + ", 专辑 《" + data.album + "》";
			musicpic.src = data.image;
			rotate = 0;
			$("#blurimgsrc").attr("xlink:href", data.image);
			$(musicpic).fadeIn();
			lrcObj = parseLyric(data.lrcs);
			setTimeout(function() {
				if(data.current != undefined) {
					musicControl.currentTime = data.current + 1;
				}
				musicControl.play();
			}, 1000);
		}
		
		// 转换时间格式
		function formatSeconds(value) {
			if(value == null || value == undefined) value = 0;
			var secondTime = parseInt(value);
			var minuteTime = 0;
			var hourTime = 0;
			if(secondTime > 60) {
				minuteTime = parseInt(secondTime / 60);
				secondTime = parseInt(secondTime % 60);
				if(minuteTime > 60) {
					hourTime = parseInt(minuteTime / 60);
					minuteTime = parseInt(minuteTime % 60);
				}
			}
			secondTime = parseInt(secondTime);
			minuteTime = parseInt(minuteTime);
			hourTime   = parseInt(hourTime);
			if(secondTime < 10) secondTime = "0" + parseInt(secondTime);
			if(minuteTime < 10) minuteTime = "0" + parseInt(minuteTime);
			if(hourTime < 10) hourTime = "0" + parseInt(hourTime);
			return hourTime + ":" + minuteTime + ":" + secondTime;
		}
		
		// 发送聊天消息
		function sendmsg() {
			var message = msginput.value;
			if(message == "") {
				alert("消息不能为空");
				return;
			}
			if(!ws_connected) {
				alert("请等待服务器连接");
				return;
			}
			var wait_send = {
				type: "msg",
				data: message
			};
			websocket.send(JSON.stringify(wait_send));
			msginput.value = "";
			//msginput.disabled = true;
			sendmsgbtn.disabled = true;
			setTimeout(function() {
				//msginput.disabled = false;
				sendmsgbtn.disabled = false;
				$(msginput).focus();
			}, 1000);
		}
		
		// 连接服务器
		function connect() {
			websocket = new WebSocket(ws_hostname);
			websocket.onopen = function (event) {
				$("#chatdata").html("");
				ws_connected = true;
				var userNick = window.localStorage.getItem("username");
				if(userNick != null && userNick != undefined) {
					websocket.send('{"type":"msg","data":"设置昵称 ' + userNick + '"}');
				}
			};
			websocket.onclose = function (event) {
				ws_connected = false;
				setTimeout("connect()", 5000);
			};
			websocket.onmessage = function (event) {
				handle(event.data);
			};
			websocket.onerror = function (event, e) {
				ws_connected = false;
			};
			var blackboard = "更新日志2020.03.17:\n发送消息后输入框不会再锁定\n发送按钮冷却现在是1秒\n现可以使用 @img 图片链接 来发送图片\n同时，发送表情功能已经可用\n选择表情后会自动复制链接到剪切板\n请直接在聊天框粘贴"
			alert(blackboard);
		}
		
		// 处理消息
		function handle(data) {
			try {
				var json = JSON.parse(data);
				if(json.type != undefined) {
					switch(json.type) {
						case "msg":
							print(json.data);
							break;
						case "chat":
							chat(json);
							break;
						case "music":
							music(json);
							break;
						case "list":
							musicList.innerHTML = json.data;
							break;
						case "online":
							$("#online-user").html(json.data);
							break;
						case "setname":
							window.localStorage.setItem("username", json.data);
							break;
						default:
							print("Unknown message type: " + json.type);
					}
				}
			} catch(e) {
				print(e.getMessage());
			}
		}
		// 网页加载完毕
		document.onreadystatechange = function() {
			if(document.readyState == "complete") {
				$('.sidenav').sidenav();
				$("#msginput").keydown(function(e) {
					if(e.keyCode == 13){
						sendmsg();
					}
				});
				setInterval(function() {
					var curTime = musicControl.currentTime.toFixed();
					if(lrcObj[curTime] != undefined && lrcObj[curTime] != "") {
						musiclrc.innerText = lrcObj[curTime];
					}
				}, 1000);
				setInterval(function() {
					played.style.width = ((musicControl.currentTime / musicControl.duration) * 100) + "%";
					usedtime.innerText = formatSeconds(musicControl.currentTime);
					endtime.innerText = formatSeconds(musicControl.duration - musicControl.currentTime);
				}, 100);
				setInterval(function() {
					if(ws_connected) {
						websocket.send('{"type":"heartbeat"}');
					}
				}, 3000);
				setInterval(function() {
					if(!paused) {
						rotate = rotate + 1;
						musicpic.style.transform = "rotate(" + rotate + "deg)";
					}
					if(document.body.clientWidth <= 600) {
						$(".input-group").attr("style", inputGroupCss);
					} else {
						$(".input-group").attr("style", "");
					}
				}, 100);
			}
		}