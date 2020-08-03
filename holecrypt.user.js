// ==UserScript==
// @name         HoleCrypt
// @namespace    https://github.com/HoleCryptDev/holecrypt
// @version      0.1
// @description  PGP encryption for THUHole.
// @author       HoleCryptDev
// @match        https://thuhole.com/
// @grant        none
// @require      https://cdnjs.cloudflare.com/ajax/libs/openpgp/4.10.7/compat/openpgp.min.js
// ==/UserScript==

(() => {

  const KEY = "plugin_holecrypt_config";
  if (!window.localStorage[KEY]) {
      window.localStorage[KEY] = "{}";
  }

  function reload_keys() {

      let data = JSON.parse(window.localStorage[KEY]);
      let option = document.getElementById("rsa-keys");
      let t = "";


      for (let k of Object.keys(data)) {
          t += (`<option value="${k}">${data[k].name}-${k}${(data[k].privkey?"（私钥）":"")}</option>`);
      }
      option.innerHTML = t;
  }

  function popup(message, title = "HoleCrypt") {
      let w = window.open("about:blank", "", 'height=600,width=800');
      w.document.title = title;
      w.document.body.innerText = message;
      //w.document.body.appendChild(document.createTextNode(message));
  }

  // Setters.
  function setNativeValue(element, value) {
      const valueSetter = Object.getOwnPropertyDescriptor(element, 'value').set;
      const prototype = Object.getPrototypeOf(element);
      const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value').set;

      if (valueSetter && valueSetter !== prototypeValueSetter) {
          prototypeValueSetter.call(element, value);
      } else {
          valueSetter.call(element, value);
      }
  }

  function setTextArea(textarea, value) {
      setNativeValue(textarea, value);
      textarea.dispatchEvent(new Event('input', {
          bubbles: true
      }));
  }

  async function transform_text(f) {
      let textarea = document.getElementsByTagName("textarea")[0];
      let v = await f(textarea.value);
      setTextArea(textarea, v);
  }

  // Getters.

  const SETTINGS = "<div><div class=\"box config-ui-header\"><p>这些功能仍在测试，可能不稳定";
  const REPLY = '<div class="box box-tip"><span><a><span class="icon icon-flag"></span><label>举报</label>';
  const POST = '<form class="post-form box"><div class="post-form-bar"><label>图片';
  const SETTINGS_FORM = `
<div class="box">
  <p><b>HoleCrypt 密钥管理</b>
  </p><p>已有的密钥对（红色表示有私钥）：<select name="rsa-keys" id="rsa-keys" class="config-select">
  <option value="A">A</option>
</select>
  </p><p></p>

<p>
  <button type="button" onclick="window.HOLECRYPT.createKey()">创建新的公钥</button>
  <button type="button" onclick="window.HOLECRYPT.deleteKey()">删除选中公钥</button>
  <button type="button" onclick="window.HOLECRYPT.downloadPubkey()">查看公钥</button>
  <button type="button" onclick="window.HOLECRYPT.downloadPrikey()">查看私钥<font color="red">（危险！）</font></button>
  </p>
</div>
`;
  const POST_FORM = `
<div class="box">
  <div class="post-form-bar">加密选项 Powered by HoleEncrypt</div>
  <p>
  选择要使用的密钥对：
<select class="config-select" id="rsa-keys">
  <option value="A">A</option>
</select>
  </p>
  
  <p>
  <button type="button" onclick="window.HOLECRYPT.createKey()">创建新的密钥对</button>
  <button type="button" onclick="window.HOLECRYPT.appendPubkey()">将公钥添加到帖子内容</button>
  <button type="button" onclick="window.HOLECRYPT.encryptContent()">用公钥加密内容<font color='red'>（不可逆！）</font></button>
  <button type="button" onclick="window.HOLECRYPT.signContent()">用私钥签名内容</button>
  </p>
</div>
`;
  const POST_CHECKSIGN = `
<hr>这是一条用PGP发布的签名消息，<a href="#" class="href_check_sign" style="color: #ffffff;">检查签名</a>
`;
  const POST_PUBKEY = `
<hr>这是一条PGP公钥，<a href="#" class="href_add_pubkey" style="color: #ffffff;">添加公钥</a>
`;
  const POST_DECRYPT = `
<hr>这是一条用PGP发布的加密消息，<a href="#" class="href_decrypt" style="color: #ffffff;">解密</a>
`;


  let observer = new MutationObserver(function(mutations) {
      //console.log(mutations);
      for (let i of mutations) {
          for (let j of i.addedNodes) {
              if (j.innerHTML) {
                  if (j.innerHTML.indexOf(SETTINGS) >= 0) {
                      console.log("打开了设置界面");
                      let d = document.createElement("div");
                      d.innerHTML = SETTINGS_FORM;
                      document.getElementsByClassName("bg-preview")[0].parentElement.parentElement.parentElement.appendChild(d);
                      reload_keys()
                  } else if (j.innerHTML.indexOf(REPLY) >= 0) {
                      console.log("打开了回复界面");
                      let d = document.createElement("div");
                      d.innerHTML = POST_FORM;
                      document.getElementsByClassName("reply-form")[0].parentElement.appendChild(d);
                      reload_keys()

                  } else if (j.innerHTML.indexOf(POST) >= 0) {
                      console.log("打开了发帖界面");
                      let d = document.createElement("div");
                      d.innerHTML = POST_FORM;
                      document.getElementsByClassName("sidebar-content")[0].appendChild(d);
                      reload_keys()

                  }
              }
          }
      }
      //console.log(mutations);
      if (document.getElementsByClassName("reply-form")[0]) {
          for (let box of document.getElementsByClassName("reply-form")[0].parentElement.getElementsByClassName("hljs")) {
              if (box.getAttribute("holecrypted")) {
                  continue;
              }
              box.setAttribute("holecrypted", 1);
              let code = box.children[0].innerText;
              if (code.indexOf("-----BEGIN PGP SIGNED MESSAGE-----") == 0) {
                  let d = document.createElement("div");
                  d.innerHTML = POST_CHECKSIGN;
                  //console.log(d)
                  console.log(d.getElementsByClassName("href_check_sign"))
                  d.getElementsByClassName("href_check_sign")[0].onclick = (async () => {
                      let data = JSON.parse(window.localStorage[KEY]);
                      let all_pub_keys = [];
                      for (let i of Object.keys(data)) {
                          let k = (await openpgp.key.readArmored(data[i].pubkey)).keys[0];
                          all_pub_keys.push(k);
                      }
                      try {
                          let verified = await openpgp.verify({
                              message: await openpgp.cleartext.readArmored(code),
                              publicKeys: all_pub_keys
                          });
                          let valid = verified.signatures[0];
                          if (valid) {
                              let hex = valid.keyid.toHex();
                              alert(`该消息被 ${data[hex].name}-${hex} 签名`);
                          } else {
                              alert("该消息没有已知的签名！");
                          }
                      } catch (err) {
                          console.log(err);
                          alert("检验失败，请查看控制台");
                      }
                  });
                  box.appendChild(d);
              } else if (code.indexOf("-----BEGIN PGP PUBLIC KEY BLOCK-----") == 0) {
                  let d = document.createElement("div");
                  d.innerHTML = POST_PUBKEY;
                  d.getElementsByClassName("href_add_pubkey")[0].onclick = (async () => {



                      try {
                          let pk = (await openpgp.key.readArmored(code)).keys[0];
                          let hex = pk.primaryKey.getKeyId().toHex();
                          let data = JSON.parse(window.localStorage[KEY]);
                          if (data[hex]) {
                              alert(`该公钥已存在：${data[hex].name}-${hex}`);
                          } else {
                              let default_name = `${pk.users[0].userId.userid}（` + "#" + document.getElementsByClassName("sidebar-title")[0].innerText.split("#")[1] + "的" + box.parentElement.innerText.split("]")[0].split("[")[1] + "）";
                              let name = window.prompt("请输入密钥对名称", default_name);
                              if (name != null) {

                                  data[hex] = {
                                      "pubkey": code,
                                      name
                                  };
                                  window.localStorage[KEY] = JSON.stringify(data);
                                  reload_keys();
                              }
                              alert("添加成功");
                          }

                      } catch (err) {
                          console.log(err);
                          alert("添加失败，请查看控制台");
                      }

                  });
                  box.appendChild(d);
              } else if (code.indexOf("-----BEGIN PGP MESSAGE-----") == 0) {
                  let d = document.createElement("div");
                  d.innerHTML = POST_DECRYPT;
                  d.getElementsByClassName("href_decrypt")[0].onclick = (async () => {
                      let data = JSON.parse(window.localStorage[KEY]);
                      let all_pri_keys = [];
                      for (let i of Object.keys(data)) {
                          if (data[i].privkey) {
                              let k = (await openpgp.key.readArmored(data[i].privkey)).keys[0];
                              all_pri_keys.push(k);
                          }
                      }
                      console.log(all_pri_keys)
                      try {
                          let decrypted = await openpgp.decrypt({
                              message: await openpgp.message.readArmored(code),
                              privateKeys: all_pri_keys
                          });
                          popup(decrypted.data);

                      } catch (err) {
                          console.log(err);
                          alert("解密失败");
                      }
                  });
                  box.appendChild(d);
              }



          }
      }
  });

  observer.observe(document.getElementsByClassName("sidebar")[0], {
      childList: true,
      subtree: true
  });



  window.HOLECRYPT = {
      "downloadPubkey": function() {
          let k = document.getElementById("rsa-keys").value;
          if (!k) {
              return alert("没有选中密钥！");
          }
          let data = JSON.parse(window.localStorage[KEY])[k].pubkey;
          popup(data, "查看公钥");
      },
      "downloadPrikey": function() {
          let k = document.getElementById("rsa-keys").value;
          if (!k) {
              return alert("没有选中密钥！");
          }
          let data = JSON.parse(window.localStorage[KEY])[k].privkey;
          if (!data) {
              return alert("你没有该密钥的私钥！");
          }
          if (window.confirm("私钥是用于解密私密信息和签名的唯一凭证，注意避免外泄！")) {
              popup(data, "查看私钥");
          }
      },
      "deleteKey": function() {
          let k = document.getElementById("rsa-keys").value;
          if (!k) {
              return alert("没有选中密钥！");
          }
          let data = JSON.parse(window.localStorage[KEY]);
          if (window.confirm(`你真的要删除密钥：${data[k].name}（指纹：${k}）吗？该操作将无法撤销！`)) {
              delete data[k];
              window.localStorage[KEY] = JSON.stringify(data);
              reload_keys();
          }
      },
      "createKey": async function() {
          let name = window.prompt("请输入密钥对名称");
          if (name != null) {
              let k = await openpgp.generateKey({
                  userIds: [{
                      name
                  }], // you can pass multiple user IDs
                  rsaBits: 4096
              });
              let fingerprint = (await openpgp.key.readArmored(k.publicKeyArmored)).keys[0].primaryKey.getKeyId().toHex();
              let data = JSON.parse(window.localStorage[KEY]);
              data[fingerprint] = {
                  name,
                  "pubkey": k.publicKeyArmored,
                  "privkey": k.privateKeyArmored,
                  "revkey": k.revocationCertificate
              }
              window.localStorage[KEY] = JSON.stringify(data);
              reload_keys();
          }
      },
      "signContent": async function() {
          let k = document.getElementById("rsa-keys").value;
          if (!k) {
              return alert("没有选中密钥！");
          }
          let data = JSON.parse(window.localStorage[KEY])[k];
          if (!data.privkey) {
              return alert("你没有该密钥的私钥！");
          }
          await transform_text(async (x) => {
              let k = (await openpgp.key.readArmored(data.privkey)).keys[0];
              let ret = await openpgp.sign({
                  message: openpgp.cleartext.fromText(x),
                  privateKeys: [k]
              });
              return "```" + ret.data + "```\n"
          });
      },
      "appendPubkey": async function() {
          let k = document.getElementById("rsa-keys").value;
          if (!k) {
              return alert("没有选中密钥！");
          }
          let data = JSON.parse(window.localStorage[KEY])[k];
          await transform_text(async (x) => {
              return x + "\n```\n" + data.pubkey + "```\n";
          });
      },
      "encryptContent": async function() {
          let k = document.getElementById("rsa-keys").value;
          if (!k) {
              return alert("没有选中密钥！");
          }
          let data = JSON.parse(window.localStorage[KEY])[k];

          await transform_text(async (x) => {
              let k = (await openpgp.key.readArmored(data.pubkey)).keys[0];
              let ret = await openpgp.encrypt({
                  message: openpgp.message.fromText(x),
                  publicKeys: [k]
              });
              return "```\n" + ret.data + "```\n"
          });
      },
  };


})();
