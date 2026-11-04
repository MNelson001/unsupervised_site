// Wavy text with weird font sizes: every letter inside <main> gets its own
// random size and bobs up and down in a travelling wave.
(function () {
  var root = document.querySelector("main");
  if (!root) return;

  var SIZES = [0.6, 0.75, 0.9, 1, 1.2, 1.45, 1.8, 2.2];
  var index = 0;

  function wrapTextNode(node) {
    var text = node.nodeValue;
    if (!text.trim()) return;
    var frag = document.createDocumentFragment();
    var parts = text.split(/(\s+)/);
    parts.forEach(function (part) {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        frag.appendChild(document.createTextNode(" "));
        return;
      }
      var word = document.createElement("span");
      word.className = "wavy-word";
      for (var i = 0; i < part.length; i++) {
        var ch = document.createElement("span");
        ch.className = "wavy-char";
        ch.textContent = part[i];
        var size = SIZES[Math.floor(Math.random() * SIZES.length)];
        ch.style.fontSize = size + "em";
        ch.style.animationDelay = (index * -0.08) + "s";
        index++;
        word.appendChild(ch);
      }
      frag.appendChild(word);
    });
    node.parentNode.replaceChild(frag, node);
  }

  var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  var nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(wrapTextNode);
})();
