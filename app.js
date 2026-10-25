/* Alley PUB · customer shop, role workspaces, and support console. */
(() => {
  'use strict';

  const CATEGORIES = ['Всё меню','Бургеры','Пицца','Роллы','Закуски','Напитки'];
  const ROLE_NAMES = {
    client:'Гость', cashier:'Кассир', kitchen:'Кухня', courier:'Курьер',
    dispatcher:'Диспетчер', manager:'Менеджер', admin:'Администратор',
    boss:'Начальник', superadmin:'Супер-администратор'
  };
  const STATUS_NAMES = {
    new:'Новый', accepted:'Принят', cooking:'Готовится', ready:'Готов',
    assigned:'Курьер назначен', picked_up:'В пути', delivered:'Доставлен',
    cancelled:'Отменён'
  };
  const SEED_PRODUCTS = [
    {id:'demo-burger',name:'Бургер Alley',category:'Бургеры',description:'Сочная говяжья котлета, сыр, свежие овощи и фирменный соус.',price:2490,icon:'🍔',active:true},
    {id:'demo-cheeseburger',name:'Чизбургер',category:'Бургеры',description:'Говядина, расплавленный сыр, маринованный огурец и соус.',price:2190,icon:'🍔',active:true},
    {id:'demo-pizza',name:'Пицца Пепперони',category:'Пицца',description:'Пепперони, моцарелла, томатный соус и ароматные травы.',price:3290,icon:'🍕',active:true},
    {id:'demo-roll',name:'Ролл Филадельфия',category:'Роллы',description:'Лосось, сливочный сыр, огурец и нежный рис.',price:2890,icon:'🍣',active:true},
    {id:'demo-wings',name:'Крылышки BBQ',category:'Закуски',description:'Хрустящие куриные крылышки с соусом барбекю.',price:1990,icon:'🍗',active:true},
    {id:'demo-fries',name:'Картофель фри',category:'Закуски',description:'Золотистый картофель с солью и соусом на выбор.',price:890,icon:'🍟',active:true},
    {id:'demo-lemonade',name:'Домашний лимонад',category:'Напитки',description:'Освежающий лимонад с цитрусом и мятой.',price:790,icon:'🍋',active:true},
    {id:'demo-cola',name:'Кола',category:'Напитки',description:'Охлаждённый газированный напиток.',price:590,icon:'🥤',active:true}
  ];
  const state = {
    db:null, auth:null, user:null, profile:null, firebaseReady:false, catalogDemo:true,
    products:[...SEED_PRODUCTS], category:'Всё меню', search:'', cart:readCart(),
    settings:{kitchenEnabled:true,courierEnabled:true,storeOpen:true},
    orders:[], users:[], customers:[], promoOnly:false, unsubscribe:null
  };

  const app = document.getElementById('app');
  const money = value => `${Number(value||0).toLocaleString('ru-RU')} ₸`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stamp = () => firebase.firestore.FieldValue.serverTimestamp();
  const discount = product => Math.min(90,Math.max(0,Number(product.discountPercent||0)));
  const salePrice = product => Math.round(Number(product.price||0)*(100-discount(product))/100);
  const isManager = () => ['manager','admin','boss','superadmin'].includes(state.profile?.role);
  const isBoss = () => ['boss','superadmin'].includes(state.profile?.role);
  const isSuper = () => state.profile?.role === 'superadmin';
  const canManageMenu = () => ['manager','admin','boss','superadmin'].includes(state.profile?.role);
  const canEditPeople = () => ['boss','superadmin'].includes(state.profile?.role);
  const canSeeCRM = () => ['cashier','manager','admin','boss','superadmin'].includes(state.profile?.role);

  function readCart(){try{return JSON.parse(localStorage.getItem('alley-cart')||'[]')}catch{return []}}
  function saveCart(){localStorage.setItem('alley-cart',JSON.stringify(state.cart));paintCartBadge()}
  function toast(message){const el=document.getElementById('toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2400)}
  function audit(action, details={}){
    if(!state.db||!state.user)return Promise.resolve();
    return state.db.collection('auditLogs').add({actorId:state.user.uid,actorName:state.profile?.name||state.user.email||'',actorRole:state.profile?.role||'client',action,details,createdAt:stamp()}).catch(()=>{});
  }
  function readCartTotal(){return state.cart.reduce((n,line)=>{const p=productById(line.id);return n+(p?salePrice(p)*line.qty:0)},0)}
  function productById(id){return state.products.find(p=>p.id===id)}
  function foodIcon(p){return esc(p.icon||({Бургеры:'🍔',Пицца:'🍕',Роллы:'🍣',Закуски:'🍗',Напитки:'🥤'}[p.category]||'🍽️'))}
  function renderFooter(){return `<footer class="footer"><div class="shell"><div class="footer-grid"><div><a class="brand" href="#top"><span class="brand-mark">AP</span><span class="brand-name">ALLEY PUB<small>МЕСТО ВКУСНЫХ ВСТРЕЧ</small></span></a><p>Сочные бургеры и закуски с доставкой по Лисаковску.</p></div><div class="footer-links"><a href="https://www.instagram.com/alley_pub.lsk/" target="_blank" rel="noreferrer">Instagram ↗</a><a href="https://wa.me/77058454679" target="_blank" rel="noreferrer">WhatsApp ↗</a></div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} Alley PUB · Лисаковск</span><span>Будни · 12:00–23:00</span></div></div></footer>`}

  function setHeader(){
    const actions=document.getElementById('headerActions');
    if(!actions)return;
    actions.innerHTML=state.user
      ? `<button class="btn dark" onclick="openWorkspace()">${esc(state.profile?.name||state.user.email||'Кабинет')}</button><button class="iconbtn" onclick="showCart()" aria-label="Корзина">♧<span class="count" id="cartCount">0</span></button>`
      : `<button class="btn dark" onclick="openAuth('login')">Войти</button><button class="iconbtn" onclick="showCart()" aria-label="Корзина">♧<span class="count" id="cartCount">0</span></button>`;
    paintCartBadge();
  }
  function paintCartBadge(){
    const count=state.cart.reduce((n,x)=>n+x.qty,0);
    const badge=document.getElementById('cartCount');if(badge)badge.textContent=count;
    const drawer=document.getElementById('cartDrawer'),total=document.getElementById('cartTotal');
    if(drawer)drawer.classList.toggle('visible',count>0);
    if(total)total.textContent=money(readCartTotal());
  }
  function renderHome(){
    const products=state.products.filter(p=>p.active!==false).filter(p=>state.category==='Всё меню'||p.category===state.category).filter(p=>!state.promoOnly||discount(p)>0).filter(p=>!state.search||`${p.name} ${p.description} ${p.category}`.toLowerCase().includes(state.search.toLowerCase()));
    const online=!state.firebaseReady?'<div class="notice">Регистрация и приём заказов заработают после подключения Firebase.</div>':state.catalogDemo?'<div class="notice">Демонстрационное меню: замените блюда и цены на актуальные в кабинете начальника.</div>':'';
    app.innerHTML=`${online}<div class="shell" id="top"><section class="hero"><div class="hero-grid"><div><div class="eyebrow">Alley PUB · Лисаковск</div><h1>МЕСТО<br>ВКУСНЫХ<br><em>ВСТРЕЧ</em></h1><p class="hero-copy">Сочные бургеры, закуски и доставка по Лисаковску. Выбирайте любимое и собирайте заказ в корзине.</p><div class="hero-actions"><a class="btn" href="#menu">Открыть меню <span>↘</span></a><a class="btn dark" href="https://wa.me/77058454679" target="_blank" rel="noreferrer">WhatsApp ↗</a></div><div class="hero-meta"><span><strong>12:00–23:00</strong>будни</span><span><strong>Вкусно</strong>бургеры и закуски</span><span><strong>ALLEY</strong>свои в городе</span></div></div><div class="hero-art"><span class="art-tag">🍺 МЕСТО ВКУСНЫХ ВСТРЕЧ</span><div class="plate">🍔</div><div class="art-caption">ВКУСНЫЕ ВСТРЕЧИ<small>БУРГЕРЫ · ЗАКУСКИ · НАПИТКИ</small></div></div></div></section>
      <section class="section" id="menu"><div class="section-head"><div><div class="eyebrow">ГОТОВИМ С УДОВОЛЬСТВИЕМ</div><h2>МЕНЮ ALLEY</h2><p>Выбирайте любимое — добавляйте в корзину.</p></div><input class="search" style="max-width:245px" placeholder="Найти в меню…" value="${esc(state.search)}" oninput="setSearch(this.value)"></div><div class="category-row">${CATEGORIES.map(c=>`<button class="chip ${state.category===c?'active':''}" onclick="setCategory('${esc(c)}')">${esc(c)}</button>`).join('')}<button class="chip ${state.promoOnly?'active':''}" onclick="togglePromos()">✦ Акции</button></div><div class="product-grid">${products.length?products.map(productCard).join(''):'<div class="empty" style="grid-column:1/-1">По вашему запросу ничего не нашлось.</div>'}</div></section>
      <section class="section" id="offers"><div class="promo"><div><h2>АЛЛЕЙСКИЙ АППЕТИТ — ОСОБЫЕ ЦЕНЫ</h2><p>Следите за акциями в меню и в нашем Instagram.</p></div><a class="btn" href="https://www.instagram.com/alley_pub.lsk/" target="_blank" rel="noreferrer">Instagram Alley ↗</a></div></section>
      <section class="section" id="about"><div class="section-head"><div><div class="eyebrow">СВОИ В ЛИСАКОВСКЕ</div><h2>ALLEY — ЭТО</h2></div></div><div class="feature-grid"><article class="feature"><div class="feature-icon">🍔</div><h3>Сочные бургеры</h3><p>Горячие, сытные и собранные с любовью к хорошему вкусу.</p></article><article class="feature"><div class="feature-icon">🛵</div><h3>Быстрая доставка</h3><p>Оформите заказ онлайн — кухня и курьер увидят его сразу.</p></article><article class="feature"><div class="feature-icon">⚽</div><h3>Вместе интереснее</h3><p>Футбол, любимая еда и свои люди — следите за новостями в Instagram.</p></article></div></section></div>${renderFooter()}`;
  }
  function productCard(p){
    const d=discount(p),price=salePrice(p);
    return `<article class="product"><div class="product-visual"><span class="food">${foodIcon(p)}</span>${d?`<span class="badge">-${d}% · АКЦИЯ</span>`:''}</div><div class="product-body"><h3>${esc(p.name)}</h3><p>${esc(p.description||p.category||'Приготовим прямо перед подачей.')}</p><div class="product-bottom"><span class="price">${d?`<del>${money(p.price)}</del>`:''}${money(price)}</span><button class="addbtn" aria-label="Добавить ${esc(p.name)}" onclick="addToCart('${esc(p.id)}')">+</button></div></div></article>`;
  }
  function setCategory(category){state.category=category;renderHome()}
  function setSearch(value){state.search=value;const cursor=window.getSelection();renderHome();const input=document.querySelector('.search');input?.focus();if(cursor)cursor.removeAllRanges()}
  function togglePromos(){state.promoOnly=!state.promoOnly;renderHome()}
  function addToCart(id){const p=productById(id);if(!p)return;const line=state.cart.find(x=>x.id===id);if(line)line.qty++;else state.cart.push({id,qty:1});saveCart();toast(`${p.name} добавлен в корзину`)}
  function showCart(){
    if(!state.cart.length){toast('Корзина пока пуста');return}
    const lines=state.cart.map(line=>{const p=productById(line.id);return p?`<div class="order-card"><div class="order-head"><strong>${foodIcon(p)} ${esc(p.name)}</strong><strong>${money(salePrice(p)*line.qty)}</strong></div><div class="actions"><button class="btn dark small" onclick="changeQty('${esc(p.id)}',-1)">−</button><span>${line.qty}</span><button class="btn dark small" onclick="changeQty('${esc(p.id)}',1)">+</button><button class="btn dark small" onclick="removeFromCart('${esc(p.id)}')">Убрать</button></div></div>`:''}).join('');
    dialog('ВАША КОРЗИНА',`${lines}<div class="panel-card"><div class="order-head"><strong>Итого</strong><strong>${money(readCartTotal())}</strong></div></div><div class="actions"><button class="btn" onclick="checkout()">Оформить заказ →</button><button class="btn dark" onclick="closeDialog()">Продолжить покупки</button></div>`);
  }
  function changeQty(id,delta){const x=state.cart.find(x=>x.id===id);if(!x)return;x.qty+=delta;if(x.qty<1)state.cart=state.cart.filter(y=>y!==x);saveCart();showCart()}
  function removeFromCart(id){state.cart=state.cart.filter(x=>x.id!==id);saveCart();if(state.cart.length)showCart();else closeDialog()}
  function dialog(title,body){document.getElementById('dialogTitle').textContent=title;document.getElementById('dialogBody').innerHTML=body;document.getElementById('overlay').classList.add('open')}
  function closeDialog(){document.getElementById('overlay').classList.remove('open')}

  function openAuth(mode='login'){
    if(!state.firebaseReady)return toast('Регистрация временно недоступна: проверьте подключение Firebase.');
    const register=mode==='register';
    dialog(register?'СОЗДАТЬ АККАУНТ':'С ВОЗВРАЩЕНИЕМ',`<form class="form-grid" onsubmit="submitAuth(event,'${mode}')">${register?`<div class="field full"><label>ИМЯ</label><input name="name" required autocomplete="name" placeholder="Как к вам обращаться"></div><div class="field full"><label>ТЕЛЕФОН</label><input name="phone" required autocomplete="tel" placeholder="+7 700 000 00 00"></div>`:''}<div class="field full"><label>EMAIL</label><input name="email" type="email" required autocomplete="email" placeholder="name@example.com"></div><div class="field full"><label>ПАРОЛЬ</label><input name="password" type="password" required minlength="6" autocomplete="${register?'new-password':'current-password'}" placeholder="Не менее 6 символов"></div><div class="field full"><button class="btn" type="submit">${register?'Зарегистрироваться':'Войти'}</button></div></form><div class="actions"><button class="btn dark small" onclick="openAuth('${register?'login':'register'}')">${register?'Уже есть аккаунт? Войти':'Создать аккаунт'}</button></div>`);
  }
  async function submitAuth(event,mode){
    event.preventDefault();const f=event.target;
    try{
      if(mode==='register'){
        const cred=await state.auth.createUserWithEmailAndPassword(f.email.value.trim(),f.password.value);
        await cred.user.updateProfile({displayName:f.name.value.trim()});
        const profile={uid:cred.user.uid,name:f.name.value.trim(),phone:f.phone.value.trim(),email:f.email.value.trim().toLowerCase(),role:'client',active:true,createdAt:stamp()};
        await state.db.collection('users').doc(cred.user.uid).set(profile);
        await state.db.collection('customerDirectory').doc(cred.user.uid).set({uid:cred.user.uid,name:profile.name,phone:profile.phone,orderCount:0,createdAt:stamp()});
      }else await state.auth.signInWithEmailAndPassword(f.email.value.trim(),f.password.value);
      closeDialog();toast(mode==='register'?'Аккаунт создан':'Вы вошли');
    }catch(e){toast(authMessage(e))}
  }
  function authMessage(error){return ({'auth/email-already-in-use':'Этот email уже зарегистрирован.','auth/invalid-credential':'Проверьте email и пароль.','auth/weak-password':'Пароль должен содержать не менее 6 символов.','auth/network-request-failed':'Не удалось подключиться к Firebase.'})[error.code]||error.message||'Ошибка авторизации.'}
  async function signOut(){if(state.unsubscribe){state.unsubscribe();state.unsubscribe=null}await state.auth.signOut();toast('Вы вышли из аккаунта')}

  async function checkout(){
    if(!state.user){closeDialog();openAuth('login');toast('Войдите или создайте аккаунт, чтобы оформить заказ');return}
    if(!state.firebaseReady)return toast('Нет подключения к базе данных.');
    if(state.catalogDemo)return toast('Добавьте актуальное меню в кабинете начальника перед началом приёма заказов.');
    if(!state.settings.storeOpen)return toast('Заказы временно не принимаются.');
    if(!state.settings.kitchenEnabled)return toast('Кухня временно отключена.');
    const pickup=state.settings.courierEnabled===false;
    dialog('ОФОРМЛЕНИЕ ЗАКАЗА',`<form class="form-grid" onsubmit="submitOrder(event)"><div class="field full"><label>${pickup?'САМОВЫВОЗ':'АДРЕС ДОСТАВКИ'}</label><input name="address" ${pickup?'':'required'} placeholder="${pickup?'Самовывоз из Alley PUB':'Улица, дом, подъезд'}" value="${pickup?'Самовывоз':''}"></div><div class="field full"><label>ТЕЛЕФОН</label><input name="phone" value="${esc(state.profile?.phone||'')}" required></div><div class="field full"><label>ОПЛАТА</label><select name="payment"><option value="cash">Наличными курьеру</option><option value="kaspi">Kaspi перевод</option><option value="card">Картой при получении</option></select></div><div class="field full"><label>КОММЕНТАРИЙ</label><textarea name="comment" placeholder="Пожелания к заказу"></textarea></div><div class="field full"><div class="notice">${state.cart.map(x=>{const p=productById(x.id);return `${esc(p?.name)} × ${x.qty}`}).join('<br>')}<hr>Итого: <b>${money(readCartTotal())}</b> · ${pickup?'Самовывоз':'Доставка'}</div></div><div class="field full"><button class="btn" type="submit">Подтвердить заказ · ${money(readCartTotal())}</button></div></form>`);
  }
  async function submitOrder(event){
    event.preventDefault();const f=event.target;
    try{
      const lines=state.cart.map(x=>{const p=productById(x.id);if(!p)throw new Error('Товар больше недоступен');return {productId:p.id,name:p.name,price:salePrice(p),qty:x.qty,discountPercent:discount(p)}});
      const amount=lines.reduce((a,x)=>a+x.price*x.qty,0);
      const doc=await state.db.collection('orders').add({clientId:state.user.uid,clientName:state.profile.name||state.user.displayName||'',phone:f.phone.value.trim(),address:f.address.value.trim(),items:lines,amount,payment:f.payment.value,comment:f.comment.value.trim(),status:'new',courierId:null,courierName:'Не назначен',restaurantId:'alley-pub',restaurant:'Alley PUB',deliveryMode:state.settings.courierEnabled?'delivery':'pickup',createdAt:stamp(),updatedAt:stamp()});
      const customerRef=state.db.collection('customerDirectory').doc(state.user.uid);
      await customerRef.set({uid:state.user.uid,name:state.profile.name||'',phone:f.phone.value.trim(),orderCount:firebase.firestore.FieldValue.increment(1),lastOrderAt:stamp()},{merge:true});
      await audit('order.created',{orderId:doc.id,amount});state.cart=[];saveCart();closeDialog();toast(`Заказ №${doc.id.slice(0,6)} отправлен на кухню`);await loadMyOrders();renderWorkspace();
    }catch(e){toast(e.message||'Не удалось отправить заказ')}
  }

  async function loadMyOrders(){
    if(!state.user)return;
    try{const snap=await state.db.collection('orders').where('clientId','==',state.user.uid).get();state.orders=snap.docs.map(d=>({id:d.id,...d.data()})).sort(sortOrders)}catch(e){console.warn(e)}
  }
  function sortOrders(a,b){const av=a.createdAt?.toMillis?.()||0,bv=b.createdAt?.toMillis?.()||0;return bv-av}
  function dateLabel(value){try{return value?.toDate?.().toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'short'})||'сейчас'}catch{return 'сейчас'}}
  function orderCard(o,actions=''){
    return `<article class="order-card"><div class="order-head"><strong>ЗАКАЗ №${esc(o.id.slice(0,7).toUpperCase())} · ${esc(o.restaurant||'Alley PUB')}</strong><span class="status ${esc(o.status)}">${esc(STATUS_NAMES[o.status]||o.status)}</span></div><p>${esc(o.clientName||'Гость')} · ${esc(o.phone||'')}<br>📍 ${esc(o.address||'Самовывоз')} · ${money(o.amount)}</p><div class="order-items">${(o.items||[]).map(i=>`${esc(i.name)} × ${Number(i.qty)||1}`).join(' · ')}${o.comment?`<br>Комментарий: ${esc(o.comment)}`:''}<br>${dateLabel(o.createdAt)}${o.courierName?` · ${esc(o.courierName)}`:''}</div>${actions?`<div class="actions">${actions}</div>`:''}</article>`;
  }
  function statusButton(order,status,label,style='dark'){
    return `<button class="btn ${style} small" onclick="changeOrderStatus('${esc(order.id)}','${status}')">${esc(label)}</button>`;
  }
  function customerView(){
    const orders=state.orders.length?state.orders.map(o=>orderCard(o)).join(''):'<div class="empty">Заказов пока нет. Самое время выбрать что-нибудь вкусное.</div>';
    app.innerHTML=`<div class="shell panel-wrap"><div class="panel-card"><div class="panel-title"><div><div class="eyebrow">ЛИЧНЫЙ КАБИНЕТ</div><h1>ПРИВЕТ, ${esc((state.profile?.name||'ДРУГ').split(' ')[0].toUpperCase())}</h1></div><button class="btn dark" onclick="signOut()">Выйти</button></div><p class="muted">${esc(state.profile?.phone||state.user.email||'')}</p></div><div class="panel-card"><div class="section-head"><div><h2>МОИ ЗАКАЗЫ</h2><p>История и текущий статус заказа.</p></div><a class="btn" href="#menu">В меню →</a></div><div class="order-list">${orders}</div></div>${renderFooter()}</div>`;
  }

  function workspaceHeader(title,subtitle){return `<div class="panel-card"><div class="panel-title"><div><div class="eyebrow">ALLEY PUB · РАБОЧИЙ КАБИНЕТ</div><h1>${title}</h1><p class="muted">${subtitle||esc(state.profile?.name||'')} · ${ROLE_NAMES[state.profile?.role]||state.profile?.role}</p></div><div class="actions"><button class="btn dark" onclick="renderHomePage()">На сайт</button><button class="btn dark" onclick="signOut()">Выйти</button></div></div></div>`}
  function tabs(items,selected){return `<div class="panel-nav">${items.map(([id,label])=>`<button class="btn ${id===selected?'':'dark'} small" onclick="workspaceTab('${id}')">${label}</button>`).join('')}</div>`}
  function renderWorkspace(){
    if(!state.user||!state.profile){renderHome();return}
    switch(state.profile.role){
      case 'client':customerView();break;
      case 'cashier':renderCashier('orders');break;
      case 'kitchen':renderKitchen();break;
      case 'courier':renderCourier();break;
      case 'dispatcher':renderDispatcher();break;
      case 'manager':case 'admin':renderManager('orders');break;
      case 'boss':renderBoss('overview');break;
      case 'superadmin':renderSuper('overview');break;
      default:app.innerHTML=`<div class="shell panel-wrap">${workspaceHeader('НЕТ ДОСТУПА','Обратитесь к начальнику Alley PUB.')}</div>`;
    }
  }
  function openWorkspace(){renderWorkspace();window.scrollTo({top:0,behavior:'smooth'})}
  function renderHomePage(){renderHome();window.scrollTo({top:0,behavior:'smooth'})}
  function workspaceTab(tab){
    const r=state.profile?.role;
    if(r==='cashier')renderCashier(tab);else if(r==='manager'||r==='admin')renderManager(tab);else if(r==='boss')renderBoss(tab);else if(r==='superadmin')renderSuper(tab);
  }
  async function queryOrders(limit=120){const s=await state.db.collection('orders').orderBy('createdAt','desc').limit(limit).get();return s.docs.map(d=>({id:d.id,...d.data()}))}
  function staffOrderActions(o,role){
    if(role==='kitchen')return [o.status==='new'?statusButton(o,'accepted','Принять'): '',['new','accepted'].includes(o.status)?statusButton(o,'cooking','Начать готовить',''): '',o.status==='cooking'?statusButton(o,'ready','Готово',''): '',statusButton(o,'print','Чек на кухню')].filter(Boolean).join('');
    if(role==='courier')return [o.status==='assigned'?statusButton(o,'picked_up','Забрал'): '',o.status==='picked_up'?statusButton(o,'delivered','Доставил',''): ''].filter(Boolean).join('');
    if(role==='cashier')return [o.status==='new'?statusButton(o,'accepted','Принять'): '',statusButton(o,'print','Чек кухни')].filter(Boolean).join('');
    if(role==='dispatcher')return [o.status==='ready'?`<button class="btn dark small" onclick="assignCourier('${esc(o.id)}')">Назначить курьера</button>`:'',statusButton(o,'print','Печать чека')].filter(Boolean).join('');
    if(isManager())return [statusButton(o,'accepted','Принять'),statusButton(o,'ready','Готово',''),statusButton(o,'delivered','Доставлен'),statusButton(o,'cancelled','Отменить','dark')].join('');
    return '';
  }
  async function fetchActiveOrders(){return (await queryOrders()).filter(o=>!['delivered','cancelled'].includes(o.status))}
  async function renderCashier(tab='orders'){
    app.innerHTML=`<div class="shell panel-wrap">${workspaceHeader('КАССА','Принимайте онлайн-заказы, оформляйте самовывоз и печатайте кухонные чеки.')}${tabs([['orders','Заказы'],['pos','Новый заказ'],['crm','CRM']],tab)}<div id="workspaceContent" class="panel-card"><div class="loading">Загружаем…</div></div>${renderFooter()}</div>`;
    const p=document.getElementById('workspaceContent');
    try{
      if(tab==='crm'){const s=await state.db.collection('customerDirectory').orderBy('createdAt','desc').limit(300).get();const rows=s.docs.map(d=>({id:d.id,...d.data()}));p.innerHTML=`<h2>CRM КЛИЕНТОВ</h2><input class="search" placeholder="Поиск по имени или телефону" oninput="filterRows(this.value)"><div class="table-wrap"><table><thead><tr><th>Имя</th><th>Телефон</th><th>Заказы</th><th>Последний заказ</th></tr></thead><tbody id="crmRows">${rows.map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.phone)}</td><td>${Number(c.orderCount)||0}</td><td>${dateLabel(c.lastOrderAt)}</td></tr>`).join('')}</tbody></table></div>`;return}
      if(tab==='pos'){p.innerHTML=`<h2>НОВЫЙ ЗАКАЗ · САМОВЫВОЗ</h2><form class="form-grid" onsubmit="cashierCreateOrder(event)"><div class="field full"><label>ИМЯ КЛИЕНТА</label><input name="name" placeholder="Гость"></div><div class="field"><label>ТЕЛЕФОН</label><input name="phone" placeholder="+7"></div><div class="field"><label>ОПЛАТА</label><select name="payment"><option value="cash">Наличные</option><option value="kaspi">Kaspi</option><option value="card">Карта</option></select></div><div class="field full"><label>ПОЗИЦИИ · ВВЕДИТЕ НАЗВАНИЕ И СУММУ</label><textarea name="items" required placeholder="Бургер Alley × 1 — 2490\nКартофель фри × 1 — 890"></textarea></div><div class="field full"><label>СУММА, ₸</label><input name="amount" type="number" min="0" required></div><div class="field full"><button class="btn">Создать заказ и напечатать чек</button></div></form>`;return}
      const orders=await fetchActiveOrders();p.innerHTML=`<div class="section-head"><div><h2>ЗАКАЗЫ НА КАССЕ</h2><p>Новые и активные заказы Alley PUB.</p></div><button class="btn dark small" onclick="workspaceTab('orders')">Обновить</button></div><div class="order-list">${orders.map(o=>orderCard(o,staffOrderActions(o,'cashier'))).join('')||'<div class="empty">Новых заказов нет.</div>'}</div>`;
    }catch(e){p.innerHTML=`<div class="notice danger">Не удалось загрузить: ${esc(e.message)}</div>`}
  }
  function filterRows(q){document.querySelectorAll('#crmRows tr').forEach(row=>row.hidden=!row.innerText.toLowerCase().includes(q.toLowerCase()))}
  async function cashierCreateOrder(event){event.preventDefault();const f=event.target;try{const items=f.items.value.split('\n').filter(Boolean).map(x=>({name:x.trim(),qty:1,price:0}));const ref=await state.db.collection('orders').add({clientId:`walkin-${state.user.uid}`,clientName:f.name.value.trim()||'Гость',phone:f.phone.value.trim(),address:'Самовывоз · Alley PUB',items,amount:Number(f.amount.value),payment:f.payment.value,status:'accepted',courierId:null,courierName:'Самовывоз',restaurantId:'alley-pub',restaurant:'Alley PUB',deliveryMode:'pickup',createdBy:state.user.uid,createdAt:stamp(),updatedAt:stamp()});await audit('pos.order.created',{orderId:ref.id});await printOrder(ref.id,true);toast('Заказ принят');renderCashier('orders')}catch(e){toast(e.message||'Не удалось создать заказ')}}
  async function renderKitchen(){
    app.innerHTML=`<div class="shell panel-wrap">${workspaceHeader('КУХНЯ','Очередь заказов Alley PUB. Переводите готовые блюда дальше по цепочке.') }<div class="panel-card"><div class="section-head"><div><h2>КУХОННЫЙ ЭКРАН</h2><p>Новые → готовятся → готовы к выдаче.</p></div><button class="btn dark small" onclick="renderKitchen()">Обновить</button></div><div id="workspaceContent" class="order-list"><div class="loading">Загружаем…</div></div></div>${renderFooter()}</div>`;
    try{if(!state.settings.kitchenEnabled){document.getElementById('workspaceContent').innerHTML='<div class="notice">Кухня отключена главным администратором.</div>';return}const all=await fetchActiveOrders(),orders=all.filter(o=>['new','accepted','cooking'].includes(o.status));document.getElementById('workspaceContent').innerHTML=orders.map(o=>orderCard(o,staffOrderActions(o,'kitchen'))).join('')||'<div class="empty">Кухня свободна — новых заказов нет.</div>'}catch(e){document.getElementById('workspaceContent').innerHTML=`<div class="notice danger">${esc(e.message)}</div>`}
  }
  async function renderCourier(){
    app.innerHTML=`<div class="shell panel-wrap">${workspaceHeader('КУРЬЕР','Ваши назначенные заказы и доставка клиентам.') }<div class="panel-card"><div class="section-head"><div><h2>МОИ ДОСТАВКИ</h2><p>Примите заказ и отметьте доставку.</p></div><button class="btn dark small" onclick="renderCourier()">Обновить</button></div><div id="workspaceContent" class="order-list"><div class="loading">Загружаем…</div></div></div>${renderFooter()}</div>`;
    try{if(!state.settings.courierEnabled){document.getElementById('workspaceContent').innerHTML='<div class="notice">Курьерская доставка временно отключена.</div>';return}const s=await state.db.collection('orders').where('courierId','==',state.user.uid).get(),orders=s.docs.map(d=>({id:d.id,...d.data()})).sort(sortOrders).filter(o=>!['delivered','cancelled'].includes(o.status));document.getElementById('workspaceContent').innerHTML=orders.map(o=>orderCard(o,staffOrderActions(o,'courier'))).join('')||'<div class="empty">Активных доставок пока нет. Диспетчер назначит заказ.</div>'}catch(e){document.getElementById('workspaceContent').innerHTML=`<div class="notice danger">${esc(e.message)}</div>`}
  }
  async function renderDispatcher(){
    app.innerHTML=`<div class="shell panel-wrap">${workspaceHeader('ДИСПЕТЧЕР','Контролируйте поток заказов и назначайте курьеров.') }<div class="panel-card"><div class="section-head"><div><h2>ДИСПЕТЧЕРСКАЯ</h2><p>Готовые заказы требуют назначения курьера.</p></div><button class="btn dark small" onclick="renderDispatcher()">Обновить</button></div><div id="workspaceContent" class="order-list"><div class="loading">Загружаем…</div></div></div>${renderFooter()}</div>`;
    try{const orders=await fetchActiveOrders();document.getElementById('workspaceContent').innerHTML=orders.map(o=>orderCard(o,staffOrderActions(o,'dispatcher'))).join('')||'<div class="empty">Активных заказов нет.</div>'}catch(e){document.getElementById('workspaceContent').innerHTML=`<div class="notice danger">${esc(e.message)}</div>`}
  }
  async function assignCourier(orderId){try{const s=await state.db.collection('users').where('role','==','courier').get(),couriers=s.docs.filter(d=>d.data().active!==false);if(!couriers.length)throw new Error('Сначала создайте аккаунт курьера и назначьте ему роль.');dialog('НАЗНАЧИТЬ КУРЬЕРА',`<form class="form-grid" onsubmit="saveCourier(event,'${esc(orderId)}')"><div class="field full"><label>КУРЬЕР</label><select name="courier">${couriers.map(d=>`<option value="${esc(d.id)}">${esc(d.data().name||d.data().email||d.id)}</option>`).join('')}</select></div><div class="field full"><button class="btn">Назначить</button></div></form>`)}catch(e){toast(e.message)}}
  async function saveCourier(event,orderId){event.preventDefault();const uid=event.target.courier.value;try{const person=(await state.db.collection('users').doc(uid).get()).data();await state.db.collection('orders').doc(orderId).update({courierId:uid,courierName:person.name||person.email||'Курьер',status:'assigned',updatedAt:stamp()});await audit('order.courier.assigned',{orderId,courierId:uid});closeDialog();toast('Курьер назначен');renderDispatcher()}catch(e){toast(e.message)}}
  async function changeOrderStatus(orderId,status){
    if(status==='print')return printOrder(orderId);
    try{const patch={status,updatedAt:stamp()};await state.db.collection('orders').doc(orderId).update(patch);await audit('order.status.changed',{orderId,status});toast(`Статус: ${STATUS_NAMES[status]||status}`);renderWorkspace()}catch(e){toast(e.message||'Не удалось изменить заказ')}
  }
  async function printOrder(orderId,localOnly=false){
    try{let o;if(localOnly)o=state.db?((await state.db.collection('orders').doc(orderId).get()).data()):null;else o=(await state.db.collection('orders').doc(orderId).get()).data();if(!o)throw new Error('Не удалось загрузить заказ для печати');const w=window.open('','_blank','width=420,height=720');if(!w)throw new Error('Разрешите всплывающие окна для печати.');w.document.write(`<!doctype html><html lang="ru"><meta charset="utf-8"><title>Кухонный чек · Alley PUB</title><style>body{font:14px monospace;color:#111;padding:18px;max-width:340px;margin:auto}h2{text-align:center;font-size:19px}.line{display:flex;justify-content:space-between;gap:12px;margin:10px 0}hr{border:0;border-top:1px dashed #555}.muted{font-size:11px}</style><h2>ALLEY PUB<br>ЧЕК КУХНИ</h2><hr><b>Заказ №${esc(orderId.slice(0,8).toUpperCase())}</b><p>${new Date().toLocaleString('ru-RU')}</p><p>${esc(o.clientName||'Гость')} · ${esc(o.phone||'')}</p><p>${esc(o.address||'Самовывоз')}</p><hr>${(o.items||[]).map(i=>`<div class="line"><span>${esc(i.name)} × ${Number(i.qty)||1}</span><b>${money((+i.price||0)*(+i.qty||1))}</b></div>`).join('')}<hr><p class="muted">Оплата: ${esc(o.payment||'—')}</p><p class="muted">Комментарий: ${esc(o.comment||'—')}</p><p class="line"><b>ИТОГО</b><b>${money(o.amount)}</b></p><script>window.onload=()=>window.print()<\/script></html>`);w.document.close()}catch(e){toast(e.message)}
  }

  function managerTabs(tab){return tabs([['orders','Заказы'],['products','Меню и акции'],['crm','CRM'],['reports','Отчёт']],tab)}
  async function renderManager(tab='orders'){
    app.innerHTML=`<div class="shell panel-wrap">${workspaceHeader('КАБИНЕТ МЕНЕДЖЕРА','Операционное управление: заказы, меню, клиенты и смена.')}${managerTabs(tab)}<div id="workspaceContent" class="panel-card"><div class="loading">Загружаем…</div></div>${renderFooter()}</div>`;
    await renderManagerTab(tab);
  }
  async function renderManagerTab(tab){
    const p=document.getElementById('workspaceContent');if(!p)return;
    try{
      if(tab==='products'){p.innerHTML=productAdmin();return}
      if(tab==='crm'){await renderCRM(p);return}
      if(tab==='reports'){const orders=await queryOrders(500),today=orders.filter(o=>{const d=o.createdAt?.toDate?.();return d&&d.toDateString()===new Date().toDateString()});const complete=today.filter(o=>o.status==='delivered');p.innerHTML=`<h2>ОТЧЁТ ЗА СЕГОДНЯ</h2><div class="stats"><div class="stat"><strong>${today.length}</strong><span>ЗАКАЗОВ</span></div><div class="stat"><strong>${complete.length}</strong><span>ДОСТАВЛЕНО</span></div><div class="stat"><strong>${money(complete.reduce((s,o)=>s+(+o.amount||0),0))}</strong><span>ОБОРОТ ДОСТАВЛЕННЫХ</span></div><div class="stat"><strong>${orders.filter(o=>!['delivered','cancelled'].includes(o.status)).length}</strong><span>АКТИВНЫХ СЕЙЧАС</span></div></div>`;return}
      const orders=await fetchActiveOrders();p.innerHTML=`<div class="section-head"><div><h2>АКТИВНЫЕ ЗАКАЗЫ</h2><p>Управление ходом работы Alley PUB.</p></div><button class="btn dark small" onclick="renderManager('orders')">Обновить</button></div><div class="order-list">${orders.map(o=>orderCard(o,staffOrderActions(o,'manager'))).join('')||'<div class="empty">Активных заказов нет.</div>'}</div>`;
    }catch(e){p.innerHTML=`<div class="notice danger">${esc(e.message)}</div>`}
  }
  function productAdmin(){
    return `<div class="section-head"><div><h2>МЕНЮ И АКЦИИ</h2><p>Добавляйте, скрывайте, редактируйте и удаляйте блюда.</p></div><button class="btn" onclick="productForm()">+ Добавить блюдо</button></div><div class="table-wrap"><table><thead><tr><th>Блюдо</th><th>Категория</th><th>Цена</th><th>Акция</th><th>Витрина</th><th></th></tr></thead><tbody>${state.products.map(p=>`<tr><td>${foodIcon(p)} ${esc(p.name)}</td><td>${esc(p.category)}</td><td>${money(p.price)}</td><td>${discount(p)?`−${discount(p)}%`:esc(p.promo||'—')}</td><td>${p.active===false?'Скрыто':'Активно'}</td><td><button class="btn dark small" onclick="productForm('${esc(p.id)}')">Изменить</button> <button class="btn dark small" onclick="deleteProduct('${esc(p.id)}')">Удалить</button></td></tr>`).join('')||'<tr><td colspan="6">Меню пустое.</td></tr>'}</tbody></table></div>`;
  }
  async function renderCRM(panel){
    if(!canSeeCRM())throw new Error('У этой должности нет доступа к CRM.');
    const s=await state.db.collection('customerDirectory').orderBy('createdAt','desc').limit(500).get(),rows=s.docs.map(d=>d.data());
    panel.innerHTML=`<div class="section-head"><div><h2>CRM КЛИЕНТОВ</h2><p>Контакты покупателей и история заказов.</p></div></div><input class="search" placeholder="Поиск клиента" oninput="filterRows(this.value)"><div class="table-wrap"><table><thead><tr><th>Имя</th><th>Телефон</th><th>Заказы</th><th>Последний заказ</th></tr></thead><tbody id="crmRows">${rows.map(c=>`<tr><td>${esc(c.name)}</td><td><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a></td><td>${+c.orderCount||0}</td><td>${dateLabel(c.lastOrderAt)}</td></tr>`).join('')||'<tr><td colspan="4">Пока нет клиентов.</td></tr>'}</tbody></table></div>`;
  }
  function productForm(id=''){
    const p=id?productById(id):{name:'',category:'Бургеры',description:'',price:0,discountPercent:0,promo:'',icon:'🍔',active:true};if(!p)return toast('Товар не найден');
    dialog(id?'РЕДАКТИРОВАТЬ БЛЮДО':'НОВОЕ БЛЮДО',`<form class="form-grid" onsubmit="saveProduct(event,'${esc(id)}')"><div class="field full"><label>НАЗВАНИЕ</label><input name="name" required value="${esc(p.name)}"></div><div class="field"><label>КАТЕГОРИЯ</label><select name="category">${CATEGORIES.slice(1).map(c=>`<option ${p.category===c?'selected':''}>${c}</option>`).join('')}</select></div><div class="field"><label>ЦЕНА, ₸</label><input name="price" type="number" min="0" required value="${+p.price||0}"></div><div class="field"><label>СКИДКА, %</label><input name="discountPercent" type="number" min="0" max="90" value="${discount(p)}"></div><div class="field"><label>ИКОНКА</label><input name="icon" maxlength="8" value="${esc(p.icon||'🍽️')}"></div><div class="field full"><label>ОПИСАНИЕ</label><textarea name="description">${esc(p.description)}</textarea></div><div class="field full"><label>НАЗВАНИЕ АКЦИИ</label><input name="promo" value="${esc(p.promo||'')}" placeholder="Например, Комбо недели"></div><div class="field full"><label class="checkbox"><input name="active" type="checkbox" ${p.active===false?'':'checked'}> Показывать блюдо в магазине</label></div><div class="field full"><button class="btn">Сохранить</button></div></form>`);
  }
  async function saveProduct(event,id){
    event.preventDefault();if(!canManageMenu())return toast('Недостаточно прав.');const f=event.target;
    const data={name:f.name.value.trim(),category:f.category.value,description:f.description.value.trim(),price:Number(f.price.value),discountPercent:Math.min(90,Math.max(0,Number(f.discountPercent.value)||0)),promo:f.promo.value.trim(),icon:f.icon.value.trim()||'🍽️',active:f.active.checked,updatedAt:stamp(),updatedBy:state.user.uid};
    try{const ref=state.db.collection('products');if(id)await ref.doc(id).set(data,{merge:true});else await ref.add({...data,createdAt:stamp()});await audit(id?'product.updated':'product.created',{productId:id||data.name});closeDialog();await loadProducts();renderWorkspace();toast('Меню обновлено')}catch(e){toast(e.message)}
  }
  async function deleteProduct(id){if(!isManager())return toast('Недостаточно прав.');if(!confirm('Удалить это блюдо из меню?'))return;try{await state.db.collection('products').doc(id).delete();await audit('product.deleted',{productId:id});await loadProducts();renderWorkspace();toast('Блюдо удалено')}catch(e){toast(e.message)}}

  async function renderBoss(tab='overview'){
    app.innerHTML=`<div class="shell panel-wrap">${workspaceHeader('КАБИНЕТ НАЧАЛЬНИКА','Бизнес-показатели, сотрудники и операционная работа.')}${tabs([['overview','Обзор'],['orders','Заказы'],['products','Меню'],['crm','CRM'],['team','Сотрудники'],['settings','Настройки']],tab)}<div id="workspaceContent" class="panel-card"><div class="loading">Загружаем…</div></div>${renderFooter()}</div>`;
    await renderBossTab(tab);
  }
  async function renderBossTab(tab){
    const p=document.getElementById('workspaceContent');if(!p)return;
    if(tab==='orders'){return renderManagerTab('orders')}
    if(tab==='products'){p.innerHTML=productAdmin();return}
    if(tab==='crm'){return renderCRM(p)}
    if(tab==='team'){return renderPeople(p,false)}
    if(tab==='settings'){return renderSettings(p,false)}
    try{const orders=await queryOrders(500),active=orders.filter(o=>!['delivered','cancelled'].includes(o.status)),today=orders.filter(o=>o.createdAt?.toDate?.().toDateString()===new Date().toDateString());const users=(await state.db.collection('users').limit(500).get()).size;p.innerHTML=`<h2>ОБЗОР ALLEY PUB</h2><div class="stats"><div class="stat"><strong>${active.length}</strong><span>АКТИВНЫХ ЗАКАЗОВ</span></div><div class="stat"><strong>${today.length}</strong><span>ЗАКАЗОВ СЕГОДНЯ</span></div><div class="stat"><strong>${users}</strong><span>АККАУНТОВ</span></div><div class="stat"><strong>${state.settings.kitchenEnabled?'ВКЛ':'ВЫКЛ'}</strong><span>КУХНЯ · КУРЬЕР ${state.settings.courierEnabled?'ВКЛ':'ВЫКЛ'}</span></div></div><div class="notice" style="margin-top:16px">Начальник управляет работой заведения. Для технической диагностики и срочных исправлений есть отдельный кабинет супер-администратора.</div><h3 style="margin-top:20px">ПОСЛЕДНИЕ ЗАКАЗЫ</h3><div class="order-list">${orders.slice(0,8).map(o=>orderCard(o,staffOrderActions(o,'manager'))).join('')||'<div class="empty">Заказов пока нет.</div>'}</div>`}catch(e){p.innerHTML=`<div class="notice danger">${esc(e.message)}</div>`}
  }
  async function renderPeople(panel,technical){
    if(!canEditPeople())throw new Error('Управление аккаунтами доступно только начальнику и супер-администратору.');
    const s=await state.db.collection('users').limit(500).get();state.users=s.docs.map(d=>({id:d.id,...d.data()}));
    const roles=Object.entries(ROLE_NAMES).filter(([r])=>r!=='superadmin'&&(isSuper()||r!=='boss'));
    panel.innerHTML=`<h2>${technical?'АККАУНТЫ И УРОВНИ ДОСТУПА':'СОТРУДНИКИ ALLEY PUB'}</h2><p class="muted">Новый сотрудник сначала регистрируется на сайте, затем ему назначается роль. Начальнику доступны рабочие роли; супер-администратор назначается вручную владельцем проекта.</p><div class="table-wrap"><table><thead><tr><th>Имя</th><th>Email</th><th>Телефон</th><th>Роль</th><th>Статус</th><th></th></tr></thead><tbody>${state.users.map(u=>`<tr><td>${esc(u.name||'—')}</td><td>${esc(u.email||'')}</td><td>${esc(u.phone||'')}</td><td>${canEditPeople()&&u.role!=='superadmin'?`<select onchange="changeUserRole('${esc(u.id)}',this.value)">${roles.map(([r,n])=>`<option value="${r}" ${u.role===r?'selected':''}>${n}</option>`).join('')}</select>`:`${esc(ROLE_NAMES[u.role]||u.role)}`}</td><td>${u.active===false?'Отключён':'Активен'}</td><td><button class="btn dark small" onclick="toggleUser('${esc(u.id)}',${u.active===false})">${u.active===false?'Включить':'Отключить'}</button></td></tr>`).join('')}</tbody></table></div>`;
  }
  async function changeUserRole(uid,role){
    if(!canEditPeople())return toast('Недостаточно прав.');if(uid===state.user.uid&&role!=='superadmin')return toast('Нельзя понизить роль в текущем аккаунте поддержки.');
    if(role==='superadmin')return toast('Супер-администратор назначается через Firebase Console.');
    try{await state.db.collection('users').doc(uid).update({role,updatedAt:stamp()});await audit('user.role.changed',{uid,role});toast('Роль обновлена');renderWorkspace()}catch(e){toast(e.message)}
  }
  async function toggleUser(uid,enable){
    if(!canEditPeople())return toast('Недостаточно прав.');if(uid===state.user.uid&&!enable)return toast('Нельзя отключить активный аккаунт управления.');
    try{await state.db.collection('users').doc(uid).update({active:!!enable,updatedAt:stamp()});await audit('user.access.changed',{uid,active:!!enable});toast(enable?'Аккаунт включён':'Доступ отключён');renderWorkspace()}catch(e){toast(e.message)}
  }
  async function renderSettings(panel,technical){
    if(!isBoss())throw new Error('Эти настройки доступны начальнику и супер-администратору.');
    panel.innerHTML=`<h2>РЕЖИМ РАБОТЫ СЕРВИСА</h2><div class="form-grid"><label class="checkbox field full"><input type="checkbox" id="settingStore" ${state.settings.storeOpen?'checked':''}> Принимаем заказы на сайте</label><label class="checkbox field full"><input type="checkbox" id="settingKitchen" ${state.settings.kitchenEnabled?'checked':''}> Кухня включена</label><label class="checkbox field full"><input type="checkbox" id="settingCourier" ${state.settings.courierEnabled?'checked':''}> Курьерская доставка включена</label><div class="field full"><label>INSTAGRAM</label><input id="settingInstagram" value="${esc(state.settings.instagram||'https://www.instagram.com/alley_pub.lsk/')}"></div><div class="field full"><label>WHATSAPP / ТЕЛЕФОН</label><input id="settingWhatsapp" value="${esc(state.settings.whatsapp||'+77058454679')}"></div><div class="field full"><button class="btn" onclick="saveSettings()">Сохранить настройки</button></div></div><div class="notice" style="margin-top:12px">Если отключить кухню, магазин перестанет принимать заказы. При выключенной доставке покупателю будет предложен самовывоз.</div>`;
  }
  async function saveSettings(){if(!isBoss())return toast('Недостаточно прав.');try{const data={storeOpen:document.getElementById('settingStore').checked,kitchenEnabled:document.getElementById('settingKitchen').checked,courierEnabled:document.getElementById('settingCourier').checked,instagram:document.getElementById('settingInstagram').value.trim(),whatsapp:document.getElementById('settingWhatsapp').value.trim(),updatedAt:stamp(),updatedBy:state.user.uid};await state.db.collection('settings').doc('main').set(data,{merge:true});state.settings={...state.settings,...data};await audit('settings.updated');toast('Настройки сохранены');renderWorkspace()}catch(e){toast(e.message)}}

  async function renderSuper(tab='overview'){
    app.innerHTML=`<div class="shell panel-wrap">${workspaceHeader('СУПЕР-АДМИНИСТРАТОР','Технический кабинет поддержки · помощь сотрудникам и восстановление сайта.')}${tabs([['overview','Система'],['orders','Заказы'],['products','Меню'],['users','Аккаунты'],['settings','Настройки'],['diagnostics','Диагностика и резерв']],tab)}<div id="workspaceContent" class="panel-card"><div class="loading">Проверяем…</div></div>${renderFooter()}</div>`;
    await renderSuperTab(tab);
  }
  async function renderSuperTab(tab){
    const p=document.getElementById('workspaceContent');if(!p)return;
    if(tab==='orders'){const orders=await queryOrders(300);p.innerHTML=`<h2>ЗАКАЗЫ · РУЧНАЯ ПОМОЩЬ</h2><p class="muted">Супер-администратор может восстановить зависший статус и напечатать чек для кухни.</p><div class="order-list">${orders.map(o=>orderCard(o,[`<select onchange="changeOrderStatus('${esc(o.id)}',this.value)">${Object.entries(STATUS_NAMES).map(([s,n])=>`<option value="${s}" ${o.status===s?'selected':''}>${n}</option>`).join('')}</select>`,`<button class="btn dark small" onclick="printOrder('${esc(o.id)}')">Чек</button>`].join(''))).join('')||'<div class="empty">Заказов нет.</div>'}</div>`;return}
    if(tab==='products'){p.innerHTML=productAdmin();return}
    if(tab==='users'){return renderPeople(p,true)}
    if(tab==='settings'){return renderSettings(p,true)}
    if(tab==='diagnostics'){return renderDiagnostics(p)}
    p.innerHTML='<div class="loading">Проверяем связь с Firebase…</div>';
    try{const [orders,users,products]=await Promise.all([state.db.collection('orders').limit(200).get(),state.db.collection('users').limit(300).get(),state.db.collection('products').limit(300).get()]);p.innerHTML=`<h2>СИСТЕМА ALLEY PUB</h2><div class="stats"><div class="stat"><strong>Доступно</strong><span>FIREBASE AUTH</span></div><div class="stat"><strong>Доступно</strong><span>FIRESTORE</span></div><div class="stat"><strong>${orders.size}</strong><span>ЗАКАЗОВ В ВЫБОРКЕ</span></div><div class="stat"><strong>${users.size}</strong><span>АККАУНТОВ</span></div></div><div class="panel-card" style="margin-top:14px"><p>Каталог: ${products.size} позиций · кухня ${state.settings.kitchenEnabled?'включена':'выключена'} · доставка ${state.settings.courierEnabled?'включена':'выключена'}.</p><div class="notice">Поддержка может помочь с зависшим заказом, доступом сотрудника, каталогом и настройками сервиса. Управление инфраструктурой самого проекта Firebase остаётся в Firebase Console.</div></div>`}catch(e){p.innerHTML=`<div class="notice danger">Проверка Firestore не прошла: ${esc(e.message)}</div>`}
  }
  async function renderDiagnostics(panel){
    panel.innerHTML=`<h2>ДИАГНОСТИКА И РЕЗЕРВ</h2><p>Проверить ключевые коллекции и выгрузить данные, доступные вашей роли.</p><div class="actions"><button class="btn dark" onclick="runDiagnostics()">Проверить Firebase</button><button class="btn" onclick="exportBackup()">Скачать JSON-резерв</button></div><div id="diagnosticResult" class="notice" style="margin-top:14px">Запустите диагностику.</div>`;
  }
  async function runDiagnostics(){
    const el=document.getElementById('diagnosticResult');if(!el)return;el.textContent='Проверяю Firebase Auth и Firestore…';
    try{const names=['users','orders','products','settings'];const result=await Promise.all(names.map(async n=>{const s=await state.db.collection(n).limit(1).get();return `${n}: OK`}));el.textContent=`Соединение работает. ${result.join(' · ')}`}catch(e){el.textContent=`Проверка не прошла: ${e.message}`}
  }
  async function exportBackup(){
    if(!isSuper())return toast('Резервную выгрузку может создать только супер-администратор.');
    try{const names=['users','customerDirectory','orders','products','settings','auditLogs'];const out={createdAt:new Date().toISOString(),projectId:firebaseConfig.projectId,collections:{}};for(const n of names){const s=await state.db.collection(n).limit(1000).get();out.collections[n]=s.docs.map(d=>({id:d.id,...d.data()}))}const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));a.download=`alley-pub-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);await audit('backup.exported');toast('JSON-резерв сохранён')}catch(e){toast(e.message)}
  }

  async function loadProducts(){
    if(!state.db)return;
    try{const s=await state.db.collection('products').get();state.catalogDemo=s.empty;state.products=s.empty?[...SEED_PRODUCTS]:s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.category||'').localeCompare(b.category||'','ru')||(a.name||'').localeCompare(b.name||'','ru'))}
    catch(e){console.warn('Menu read failed:',e);state.catalogDemo=true;state.products=[...SEED_PRODUCTS]}
  }
  async function loadSettings(){
    if(!state.db)return;
    try{const s=await state.db.collection('settings').doc('main').get();state.settings={...state.settings,...(s.data()||{})};document.getElementById('openState').textContent=state.settings.storeOpen===false?'заказы временно закрыты':'Будни 12:00–23:00'}catch(e){console.warn('Settings read failed:',e)}
  }
  function init(){
    try{
      if(!window.firebaseConfig?.apiKey)throw new Error('firebase-config.js не настроен');
      firebase.initializeApp(window.firebaseConfig);state.auth=firebase.auth();state.db=firebase.firestore();state.firebaseReady=true;
      state.auth.onAuthStateChanged(async user=>{
        state.user=user;state.profile=null;
        if(user){try{const s=await state.db.collection('users').doc(user.uid).get();state.profile=s.exists?s.data():{uid:user.uid,name:user.displayName||'',email:user.email,role:'client',active:true};if(!s.exists)await state.db.collection('users').doc(user.uid).set({...state.profile,createdAt:stamp()},{merge:true});}catch(e){console.warn(e);state.profile={uid:user.uid,name:user.displayName||'',email:user.email,role:'client',active:true}}}
        await Promise.all([loadProducts(),loadSettings()]);setHeader();
        if(user&&state.profile?.role==='client')await loadMyOrders();
        renderWorkspaceOrHome();
      });
    }catch(e){state.firebaseReady=false;console.warn('Firebase not connected:',e);renderHome()}
    paintCartBadge();
  }
  function renderWorkspaceOrHome(){if(state.user&&state.profile?.role!=='client')renderWorkspace();else if(state.user)customerView();else renderHome()}

  Object.assign(window,{
    openAuth,submitAuth,signOut,renderHomePage,openWorkspace,showCart,closeDialog,checkout,submitOrder,
    addToCart,changeQty,removeFromCart,setCategory,setSearch,togglePromos,changeOrderStatus,printOrder,
    workspaceTab,productForm,saveProduct,deleteProduct,assignCourier,saveCourier,filterRows,
    cashierCreateOrder,changeUserRole,toggleUser,saveSettings,runDiagnostics,exportBackup
  });
  init();
})();
