/* ==========================================================================
   AMIRA OPEN — Logo
   Huy hiệu hình khiên viền vàng kim, bi số 9 ở giữa, cây cơ bắt chéo phía sau.
   Dựng bằng SVG nội tuyến để animation xoay/phóng được từng phần và nét ở mọi cỡ.

   createLogo('mark') -> chỉ huy hiệu (thanh tiêu đề, favicon, màn giới thiệu)
   createLogo('full') -> huy hiệu kèm chữ AMIRA / OPEN bên dưới (poster, mạng xã hội)
   ========================================================================== */
var createLogo = (function () {
  var seq = 0;

  function defs(u) {
    return '' +
      '<defs>' +
        /* mặt khiên: trắng ngà, sáng ở góc trên trái */
        '<linearGradient id="' + u + 'shield" x1="18%" y1="0%" x2="82%" y2="100%">' +
          '<stop offset="0%" stop-color="#ffffff"/>' +
          '<stop offset="62%" stop-color="#fffaf2"/>' +
          '<stop offset="100%" stop-color="#f6e8d6"/>' +
        '</linearGradient>' +
        /* viền vàng kim */
        '<linearGradient id="' + u + 'gold" x1="10%" y1="0%" x2="90%" y2="100%">' +
          '<stop offset="0%" stop-color="#f3daa6"/>' +
          '<stop offset="38%" stop-color="#dcae55"/>' +
          '<stop offset="100%" stop-color="#b8832f"/>' +
        '</linearGradient>' +
        /* bi số 9 */
        '<radialGradient id="' + u + 'ball" cx="34%" cy="28%" r="78%">' +
          '<stop offset="0%" stop-color="#ffc178"/>' +
          '<stop offset="42%" stop-color="#f4881f"/>' +
          '<stop offset="100%" stop-color="#c2450a"/>' +
        '</radialGradient>' +
        '<radialGradient id="' + u + 'gloss" cx="50%" cy="50%" r="50%">' +
          '<stop offset="0%" stop-color="#ffffff" stop-opacity=".75"/>' +
          '<stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>' +
        '</radialGradient>' +
        /* thân cơ */
        '<linearGradient id="' + u + 'cue" x1="0%" y1="100%" x2="100%" y2="0%">' +
          '<stop offset="0%" stop-color="#b0672c"/>' +
          '<stop offset="34%" stop-color="#dcab68"/>' +
          '<stop offset="100%" stop-color="#f0d7ac"/>' +
        '</linearGradient>' +
        '<linearGradient id="' + u + 'word" x1="0%" y1="0%" x2="100%" y2="0%">' +
          '<stop offset="0%" stop-color="#f08a2c"/>' +
          '<stop offset="100%" stop-color="#d4530a"/>' +
        '</linearGradient>' +
      '</defs>';
  }

  var SHIELD_OUTER = 'M 56 34 H 144 Q 150 34 150 40 V 92 Q 150 132 100 170 Q 50 132 50 92 V 40 Q 50 34 56 34 Z';
  var SHIELD_INNER = 'M 61 40 H 139 Q 144 40 144 45.5 V 91 Q 144 126 100 160 Q 56 126 56 91 V 45.5 Q 56 40 61 40 Z';

  function emblem(u) {
    return '' +
      '<g class="logo-emblem">' +
        /* vòng tròn mờ phía sau */
        '<circle cx="100" cy="99" r="77" fill="none" stroke="url(#' + u + 'gold)" stroke-opacity=".38" stroke-width="1.3"/>' +

        /* cây cơ nằm sau khiên, chỉ ló ra hai đầu */
        '<g class="logo-cue">' +
          '<path d="M 31.4 171.4 L 172.5 28.5 L 171.5 27.5 L 28.6 168.6 Z" fill="url(#' + u + 'cue)"/>' +
          '<circle cx="30" cy="170" r="2.2" fill="#b0672c"/>' +
        '</g>' +

        /* khiên */
        '<g class="logo-shield">' +
          '<path d="' + SHIELD_OUTER + '" fill="url(#' + u + 'shield)" stroke="url(#' + u + 'gold)" stroke-width="2.6" stroke-linejoin="round"/>' +
          '<path d="' + SHIELD_INNER + '" fill="none" stroke="url(#' + u + 'gold)" stroke-opacity=".5" stroke-width="1" stroke-linejoin="round"/>' +
        '</g>' +

        /* bi số 9 */
        '<g class="logo-ball">' +
          '<ellipse cx="100" cy="128" rx="27" ry="5" fill="#c9701f" opacity=".16"/>' +
          '<circle cx="100" cy="90" r="31" fill="url(#' + u + 'ball)"/>' +
          '<circle cx="100" cy="90" r="14" fill="#fffdf9"/>' +
          '<text class="logo-num" x="100" y="90">9</text>' +
          '<ellipse cx="87" cy="76" rx="11.5" ry="7" fill="url(#' + u + 'gloss)" transform="rotate(-28 87 76)"/>' +
          '<circle cx="100" cy="90" r="31" fill="none" stroke="#a83c06" stroke-opacity=".28" stroke-width="1.1"/>' +
        '</g>' +
      '</g>';
  }

  /* Chỉ quả bi, khung nhìn bám sát — dùng cho favicon và các cỡ rất nhỏ */
  function ballOnly(u) {
    return '' +
      '<circle cx="100" cy="90" r="31" fill="url(#' + u + 'ball)"/>' +
      '<circle cx="100" cy="90" r="14" fill="#fffdf9"/>' +
      '<text class="logo-num" x="100" y="90">9</text>' +
      '<ellipse cx="87" cy="76" rx="11.5" ry="7" fill="url(#' + u + 'gloss)" transform="rotate(-28 87 76)"/>' +
      '<circle cx="100" cy="90" r="31" fill="none" stroke="#a83c06" stroke-opacity=".28" stroke-width="1.1"/>';
  }

  return function createLogo(variant) {
    var u = 'aml' + (++seq) + '-';
    var full = variant === 'full';

    if (variant === 'icon') {
      return '<svg class="logo logo-icon" viewBox="66 56 68 68" xmlns="http://www.w3.org/2000/svg" ' +
             'role="img" aria-label="AMIRA OPEN">' + defs(u) + ballOnly(u) + '</svg>';
    }

    var box = full ? '0 0 200 252' : '16 16 168 168';
    var svg = '<svg class="logo logo-' + (full ? 'full' : 'mark') + '" viewBox="' + box + '" ' +
              'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="AMIRA OPEN — billiards 9 bi">' +
              defs(u) + emblem(u);

    if (full) {
      svg +=
        '<g class="logo-wordmark">' +
          /* x nhích phải nửa letter-spacing: text-anchor tính cả khoảng trắng
             thừa sau chữ cuối, không bù thì chữ lệch sang trái */
          '<text class="logo-word" x="101.3" y="216" fill="url(#' + u + 'word)">AMIRA</text>' +
          '<text class="logo-sub" x="104.5" y="238">OPEN</text>' +
          /* màu đặc, không dùng gradient: đường ngang có hộp bao cao 0 nên
             gradient theo objectBoundingBox sẽ không vẽ ra gì */
          '<path d="M 38 234 H 56 M 144 234 H 162" stroke="#cfa863" stroke-opacity=".9" stroke-width="1.4" stroke-linecap="round"/>' +
        '</g>';
    }

    return svg + '</svg>';
  };
})();
