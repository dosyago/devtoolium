const DEBUG = true;
const isMobile = () => true;

setupErrorCatchers();

function setupErrorCatchers() {
  (DEBUG) && (self.onerror = (...v) => (func()(v, extractMeat(v).message, extractMeat(v).stack, v+''), true));
  (DEBUG) && (self.onunhandledrejection = ({reason}) => (func()(reason + ' ' + JSON.stringify(reason,null,2)), true));
}

function func() {
  if ( isMobile() ) {
    return (...x) => {
      for( const m of x ) {
        try {
          alert(m);
          alert(JSON.stringify(m));
        } catch(e) {

        }
      }
    };
  } else {
    return (...x) => console.log(...x)
  }
}

function extractMeat(list) {
  const meatIndex = list.findIndex(val => !! val && val.message || val.stack);
  if ( meatIndex == -1 || meatIndex == undefined ) {
    return "";
  } else {
    return list[meatIndex];
  }
}


