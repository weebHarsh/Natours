/* eslint-disable */
import { showAlert } from './alerts';
import axios from 'axios';

const stripe = Stripe(
  'pk_test_51HToUIHqYCXBgBKes5AvG4GXrs2ICge2GNXmDIYqXrh1r61iZN37bg7ZR3hqkFPMI0leADPAWGxjgjTry8vuisOh00RuWF0aic'
);

export const bookTour = async tourId => {
  try {
    // 1) Get checkout session from API.
    const session = await axios(
      `http://127.0.0.1:3000/api/v1/bookings/checkout-session/${tourId}`
    );
    console.log(session);

    // 2) Create checkout + charge the credit card
    await stripe.redirectToCheckout({
      sessionId: session.data.session.id
    });
  } catch (err) {
    console.log(err);
    showAlert('error', err);
  }
};
