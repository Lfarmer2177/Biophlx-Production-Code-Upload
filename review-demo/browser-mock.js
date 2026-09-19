export const openBrowserAsync=async(url)=>new Promise(resolve=>window.dispatchEvent(new CustomEvent('demo-checkout',{detail:{url,resolve}})));
