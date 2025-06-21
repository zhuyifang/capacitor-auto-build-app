
/**
const timer = null;
addEventListener('getNewMessage', async (resolve, reject, event) => {
    console.log('Background Runner 收到新的 apiUrl getNewMessage:', event);
    try {
        if (event && event.url && event.token) {
            CapacitorKV.set('url', event.url)
            CapacitorKV.set('token', event.token)
            getNewMessage()
        } else {
            CapacitorKV.remove('url')
        }
        resolve()
    } catch (e) {
        reject()
    }
});

function setBadge(number){
    if(number>0){
        CapacitorNotifications.setBadge({
            number: number
        })
    }else{
        CapacitorNotifications.clearBadge()
    }
}

async function getNewMessage() {
    const url = CapacitorKV.get('url');
    const token = CapacitorKV.get('token');
    if (timer) {
        clearTimeout(timer)
    }
    if (!url || !token) {
        return
    }
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token,
        }
    });
    if (!response.ok) {
        throw new Error("Fetch GET request failed");
    }
    const res = await response.json();
    console.log('地址:', url);
    console.log('token:', token);
    console.log('response:', res);
    setBadge(res.data)
    setTimeout(getNewMessage, 1000 * 60 * 15)
}
 */