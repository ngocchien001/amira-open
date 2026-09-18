/* ==========================================================================
   AMIRA OPEN — Dữ liệu giải đấu
   Sửa file này để đổi người chơi / hạng / thể thức. Không cần đụng app.js.
   ========================================================================== */

/* Thang hạng: đứng trước = mạnh hơn (A mạnh nhất, I yếu nhất). */
const RANKS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

/* Người chơi. `id` dùng để tham chiếu trong nhánh đấu. */
const PLAYERS = [
  { id: 'phuong',   name: 'Phương',    rank: 'F' },
  { id: 'nam',      name: 'Nam',       rank: 'H' },
  { id: 'chien',    name: 'Chiến',     rank: 'H' },
  { id: 'hoanganh', name: 'Hoàng Anh', rank: 'G' },
  { id: 'phuc',     name: 'Phúc',      rank: 'H' },
  { id: 'hung',     name: 'Hưng',      rank: 'F' },
  { id: 'hieu',     name: 'Hiếu',      rank: 'H' },
  { id: 'bien',     name: 'Biển',      rank: 'H' },
];

/* Luật thể thức mặc định — suy ra từ chênh lệch hạng của 2 tay cơ:
     - Cùng hạng            -> chạm 7, không chấp
     - Lệch n bậc           -> chạm 8, người hạng cao chấp n ván
   Có thể ghi đè cho từng trận bằng thuộc tính `format` trong BRACKET. */
const FORMAT_RULE = {
  raceEven: 7,        // chạm bao nhiêu khi hai bên cùng hạng
  raceHandicap: 8,    // chạm bao nhiêu khi có chấp
  gamesPerRankStep: 1 // mỗi bậc hạng chênh lệch = chấp mấy ván
};

/* Giải đấu. `a` / `b` là hai vị trí của một trận:
     { player: 'id' }  -> người chơi cố định (vòng đầu)
     { from: 'matchId' } -> người thắng của trận trước */
const TOURNAMENT = {
  name: 'AMIRA OPEN',
  subtitle: 'Giải billiards 9 bi · thể thức xếp cao',
  fee: 50000,
  feeNote: 'Người thua trả tiền bàn',

  /* Thông tin hiển thị trong màn giới thiệu đầu trang */
  event: {
    format: '9 bi xếp cao',
    time: '23h00 · 25/9/2026',
    venue: 'Thái Tuấn Billiards',
    address: '39 Lê Văn Lương'
  },
  prizes: [
    { icon: '🏆', rank: 'Giải nhất', value: '200.000đ', extra: '+ Cúp vô địch' },
    { icon: '🥈', rank: 'Giải nhì',  value: '100.000đ' }
  ],
  intro: {
    /* false: chạy mỗi lần tải trang (hợp khi chiếu trang này lên màn hình ở quán).
       true : chỉ chạy lần đầu trên mỗi trình duyệt.
       Dù đặt thế nào vẫn xem lại được bằng nút "Giới thiệu" trên thanh tiêu đề. */
    showOnce: false
  },
  payment: {
    bank: 'Techcombank',
    holder: 'NGUYEN HOANG ANH',
    accountDisplay: '9468 2547 0111 23',
    accountNumber: '94682547011123',
    content: 'AMIRA Open',
    qr: 'assets/qr-techcombank.png'
  },
  rounds: [
    {
      id: 'qf', name: 'Tứ kết',
      matches: [
        { id: 'qf1', a: { player: 'phuong' }, b: { player: 'nam' } },
        { id: 'qf2', a: { player: 'chien' },  b: { player: 'hoanganh' } },
        { id: 'qf3', a: { player: 'phuc' },   b: { player: 'hung' } },
        { id: 'qf4', a: { player: 'hieu' },   b: { player: 'bien' } },
      ]
    },
    {
      id: 'sf', name: 'Bán kết',
      matches: [
        { id: 'sf1', a: { from: 'qf1' }, b: { from: 'qf2' } },
        { id: 'sf2', a: { from: 'qf3' }, b: { from: 'qf4' } },
      ]
    },
    {
      id: 'f', name: 'Chung kết',
      matches: [
        { id: 'f1', a: { from: 'sf1' }, b: { from: 'sf2' } },
      ]
    }
  ]
};
