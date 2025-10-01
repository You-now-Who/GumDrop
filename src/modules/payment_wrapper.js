var LiteAPIPayment = (function () {
  "use strict";
  function e(e, t, n, i) {
    return new (n || (n = Promise))(function (o, r) {
      function c(e) {
        try {
          d(i.next(e));
        } catch (e) {
          r(e);
        }
      }
      function s(e) {
        try {
          d(i.throw(e));
        } catch (e) {
          r(e);
        }
      }
      function d(e) {
        var t;
        e.done
          ? o(e.value)
          : ((t = e.value),
            t instanceof n
              ? t
              : new n(function (e) {
                  e(t);
                })).then(c, s);
      }
      d((i = i.apply(e, t || [])).next());
    });
  }
  "function" == typeof SuppressedError && SuppressedError;
  return class {
    constructor(e) {
      (this.publicKeyEndpoint =
        "https://payment-wrapper.liteapi.travel/config"),
        (this.paymentKeyEndpoint =
          "https://payment-wrapper.liteapi.travel/payment-key"),
        (this.defaultConfig = {
          publicKey: "",
          secretKey: "",
          options: {},
          targetElement: "#payment-element",
          returnUrl: "",
          amount: 0,
          currency: "",
          submitButton: { text: "Pay" },
        }),
        (this.config = Object.assign(Object.assign({}, this.defaultConfig), e));
    }
    handlePayment() {
      return e(this, void 0, void 0, function* () {
        var e, t;
        try {
          const n = yield this.getConfig();
          if ("" === this.config.secretKey) {
            const i = yield this.getSecretKeyFromAmount(
              null !==
                (t =
                  null === (e = n.provider) || void 0 === e
                    ? void 0
                    : e.origin) && void 0 !== t
                ? t
                : "stripe",
              n.provider.name,
              this.config.amount,
              this.config.currency,
              this.config.returnUrl
            );
            this.config.secretKey = i;
          }
          yield this.loadProviderFiles(n, () => {
            new (0, window[n.provider.className])(
              n.publicKey,
              this.config
            ).handlePayment();
          });
        } catch (e) {}
      });
    }
    loadProviderFiles(t, n) {
      return e(this, void 0, void 0, function* () {
        const e = document.createElement("link");
        (e.href = t.provider.cssFile),
          (e.rel = "stylesheet"),
          document.head.appendChild(e),
          (e.onload = () => {});
        const i = document.createElement("script");
        (i.src = t.provider.jsFile),
          (i.async = !0),
          document.head.appendChild(i),
          (i.onload = () => {
            n();
          });
      });
    }
    handleReturn() {
      return e(this, void 0, void 0, function* () {});
    }
    getSecretKeyFromAmount(t, n, i, o, r) {
      return e(this, void 0, void 0, function* () {
        const e = {
            amount: i,
            currency: o,
            provider: n,
            returnUrl: r,
            origin: t,
          },
          c = yield fetch(this.paymentKeyEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(e),
          }),
          { key: s } = yield c.json();
        return s;
      });
    }
    getConfig() {
      return e(this, void 0, void 0, function* () {
        if (!this.config.publicKey || "" === this.config.publicKey)
          throw new Error("no public key");
        let e = yield fetch(this.publicKeyEndpoint, {
          method: "POST",
          body: JSON.stringify({ publicKey: this.config.publicKey }),
          headers: { "Content-Type": "application/json" },
        });
        if (!e.ok) throw new Error("failed to get config");
        return yield e.json();
      });
    }
  };
})();
