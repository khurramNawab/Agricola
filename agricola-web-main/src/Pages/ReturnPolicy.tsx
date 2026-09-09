import { Link } from "react-router-dom";
import Footer from "../components/layout/Footer";

// Draft return/refund policy for a perishable/agri store. Review and adjust the
// windows, timelines, and contact details to match your actual operations.
const UPDATED = "August 2026";

export default function ReturnPolicy() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <main className="flex-1">
        <div className="container mx-auto max-w-3xl px-4 py-12">
          <h1 className="mb-2 font-serif text-3xl text-gray-900 sm:text-4xl">
            Return &amp; Refund Policy
          </h1>
          <p className="mb-10 text-sm text-gray-500">Last updated: {UPDATED}</p>

          <div className="space-y-8 text-sm leading-relaxed text-gray-600">
            <p>
              We want you to be happy with every order from AgriCola. Because many
              of our products are fresh or perishable, the terms below explain when
              and how you can return an item or request a refund.
            </p>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-gray-900">
                Reporting window
              </h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <span className="font-medium text-gray-800">Perishable items</span>{" "}
                  (fruits, vegetables, dairy, and other fresh produce): report any
                  issue within <span className="font-medium">48 hours</span> of
                  delivery.
                </li>
                <li>
                  <span className="font-medium text-gray-800">Non-perishable items</span>{" "}
                  (grains, pulses, spices, seeds, packaged goods): report within{" "}
                  <span className="font-medium">7 days</span> of delivery, unopened
                  and in original packaging.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-gray-900">
                Eligible for return / refund
              </h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>The item arrived damaged, spoiled, or defective.</li>
                <li>You received the wrong item or an incorrect quantity.</li>
                <li>The item has a genuine quality issue.</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-gray-900">
                Not eligible
              </h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  Perishable goods that have been opened or partially used, unless
                  there is a quality issue.
                </li>
                <li>Change of mind on perishable/fresh items.</li>
                <li>Items reported after the applicable window above.</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-gray-900">
                How to request
              </h2>
              <p>
                Contact our support team with your <span className="font-medium">Order ID</span>{" "}
                and a photo of the item (for damage/quality issues):
              </p>
              <p className="mt-2">
                📞{" "}
                <a href="tel:+919012659000" className="text-green-600 hover:underline">
                  +91 9012659000
                </a>{" "}
                &nbsp;·&nbsp; ✉️{" "}
                <a
                  href="mailto:support@agricola.co.in"
                  className="text-green-600 hover:underline"
                >
                  support@agricola.co.in
                </a>
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-gray-900">
                Refunds &amp; replacements
              </h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  Once your request is approved, we'll offer a{" "}
                  <span className="font-medium">replacement</span> or a{" "}
                  <span className="font-medium">refund</span>.
                </li>
                <li>
                  Refunds are issued to your original payment method within{" "}
                  <span className="font-medium">5–7 business days</span> of approval.
                  For Cash on Delivery orders, we'll arrange a bank/UPI refund.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-gray-900">
                Order cancellation
              </h2>
              <p>
                You can cancel an order any time before it is dispatched. Once a
                shipment has been handed to the courier, cancellation may not be
                possible — please use the return process above instead.
              </p>
            </section>

            <p className="border-t border-gray-100 pt-6 text-gray-500">
              Questions? Visit our{" "}
              <Link to="/contact" className="text-green-600 hover:underline">
                Contact
              </Link>{" "}
              page or reach us at the number above.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
