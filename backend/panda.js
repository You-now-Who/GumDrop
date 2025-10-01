const url = 'https://book.liteapi.travel/v3.0/rates/book';
const options = {
  method: 'POST',
  headers: {
    accept: 'application/json',
    'content-type': 'application/json',
    'X-API-Key': 'sand_092c4b92-5e26-452c-8efd-49d93cc35c39'
  },
  body: JSON.stringify({
    holder: {
      firstName: 'Yash',
      lastName: 'Yadav',
      email: 'yash@yadav.com',
      phone: '8788095965'
    },
    guestPayment: {
      address: {city: 'NYC', address: '123 Main Street', country: 'US', postal_code: '10001'},
      payee_last_name: 'Yadav',
      payee_first_name: 'Yash',
      last_4_digits: '1111',
      phone: '10410241024',
      method: 'ACC_CREDIT_CARD'
    },
    payment: {method: 'ACC_CREDIT_CARD'},
    guests: [
      {
        occupancyNumber: 1,
        remarks: 'quiet room please',
        firstName: 'Yash',
        lastName: 'Yadav',
        email: 'here@gmail.com',
        phone: '8788095965'
      }
    ],
    prebookId: 'c5iYVQmzj'
  })
};

fetch(url, options)
  .then(res => res.json())
  .then(json => console.log(json))
  .catch(err => console.error(err));