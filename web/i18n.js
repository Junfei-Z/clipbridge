(()=>{
  const KEY="clipbridge.language.v1";
  const EN={
    "在线点对点直传":"Online peer-to-peer transfer","未连接":"Not connected","已直连":"Directly connected",
    "让两台设备直接连接":"Connect two devices directly","页面只负责建立连接。文字和文件通过加密的 WebRTC DataChannel 在设备之间传输。":"This page only establishes the connection. Text and files travel between devices through an encrypted WebRTC DataChannel.",
    "建立连接":"Connect","创建一个 6 位临时房间码，另一台设备输入后自动直连。":"Create a temporary 6-digit room code. Enter it on the other device to connect automatically.",
    "创建连接":"Create connection","加入连接":"Join connection","断开":"Disconnect","让另一台设备扫描二维码，或输入下面的房间码。房间 5 分钟后失效。":"Ask the other device to scan the QR code or enter the room code below. The room expires in 5 minutes.",
    "房间码":"Room code","复制房间码":"Copy room code","房间二维码":"Room QR code","输入另一台设备上的 6 位房间码":"Enter the 6-digit room code shown on the other device","加入房间":"Join room",
    "发送内容":"Send content","连接成功后可以双向发送文字和文件。":"After connecting, both devices can send text and files.","文字":"Text","输入要发送的文字":"Enter text to send","发送文字":"Send text","文件":"Files","发送所选文件":"Send selected files",
    "收到的内容":"Received content","内容只保留在当前页面；刷新页面后清空。":"Content stays only on this page and is cleared when the page reloads.","还没有收到内容":"Nothing received yet","ClipBridge 不上传传输内容 ·":"ClipBridge does not upload transfer content ·","源代码":"Source code",
    "网络候选收集超时":"Network candidate discovery timed out","连接发生错误，请重新配对":"A connection error occurred. Pair again.","两台设备已建立加密的点对点连接":"The two devices now have an encrypted peer-to-peer connection",
    "等待另一台设备加入…":"Waiting for the other device…","已加入房间，正在协商连接…":"Joined the room. Negotiating the connection…","无法连接短码服务，请稍后重试":"Could not reach the room-code service. Try again later.",
    "房间码不存在或已经过期":"The room code does not exist or has expired","这个房间已经有两台设备":"This room already has two devices","另一台设备已离开房间":"The other device left the room","连接失败":"Connection failed","连接协商失败":"Connection negotiation failed",
    "另一台设备已加入，正在建立点对点连接…":"The other device joined. Establishing a peer-to-peer connection…","正在创建临时房间…":"Creating a temporary room…","短码服务暂时不可用，请稍后重试":"The room-code service is temporarily unavailable. Try again later.",
    "请输入完整的 6 位房间码":"Enter the complete 6-digit room code","复制":"Copy","下载文件":"Download file","设备尚未连接":"The devices are not connected yet","文字已发送":"Text sent","操作失败":"Operation failed","房间码已复制":"Room code copied"
  };
  const lang=(()=>{const saved=localStorage.getItem(KEY);return saved==="zh"||saved==="en"?saved:(navigator.language.toLowerCase().startsWith("zh")?"zh":"en")})();
  function translate(value){
    if(lang!=="en")return value;
    const source=String(value),text=source.trim();let result=EN[text];
    if(!result){
      const rules=[
        [/^加入 ClipBridge 房间 ([0-9]{6})$/,(_,code)=>"Join ClipBridge room "+code],
        [/^收到文字$/,()=>"Text received"],
        [/^文件 (.+) 校验失败$/,(_,name)=>"File verification failed: "+name],
        [/^已收到 (.+)$/,(_,name)=>"Received "+name],
        [/^正在接收 (.+) · ([0-9]+)%$/,(_,name,percent)=>"Receiving "+name+" · "+percent+"%"],
        [/^(.+) 已发送$/,(_,name)=>name+" sent"]
      ];
      for(const [pattern,replacement] of rules)if(pattern.test(text)){result=text.replace(pattern,replacement);break}
    }
    return result?source.replace(text,result):source;
  }
  function apply(root){
    if(!root||root.nodeType===1&&root.closest("[data-no-translate]"))return;
    if(root.nodeType===3){const parent=root.parentElement;if(!parent||["SCRIPT","STYLE"].includes(parent.tagName))return;const next=translate(root.nodeValue);if(root.nodeValue!==next)root.nodeValue=next;return}
    if(root.nodeType!==1&&root.nodeType!==9)return;
    const elements=root.nodeType===1?[root,...root.querySelectorAll("*")]:[...document.querySelectorAll("*")];
    for(const element of elements){if(element.closest("[data-no-translate]"))continue;for(const attribute of ["aria-label","placeholder","title"]){if(!element.hasAttribute(attribute))continue;const next=translate(element.getAttribute(attribute));if(element.getAttribute(attribute)!==next)element.setAttribute(attribute,next)}}
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode())apply(node);
  }
  document.documentElement.lang=lang==="en"?"en":"zh-CN";apply(document);
  const toggle=document.querySelector("#language-toggle");toggle.textContent=lang==="en"?"中文":"EN";toggle.setAttribute("aria-label",lang==="en"?"切换到中文":"Switch to English");toggle.onclick=()=>{localStorage.setItem(KEY,lang==="en"?"zh":"en");location.reload()};
  new MutationObserver(changes=>{if(lang!=="en")return;for(const change of changes){if(change.type==="characterData"||change.type==="attributes")apply(change.target);for(const node of change.addedNodes)apply(node)}}).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["aria-label","placeholder","title"]});
})();
