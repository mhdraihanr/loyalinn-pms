<?php

if (!defined('_PS_VERSION_')) {
    exit;
}

require_once dirname(__FILE__) . '/classes/LoyalinnWebhookClient.php';
require_once dirname(__FILE__) . '/classes/LoyalinnWebhookLogger.php';

class Loyalinnwebhooksync extends Module
{
    const CONF_ENABLED = 'LOYALINN_WEBHOOKSYNC_ENABLED';
    const CONF_ENDPOINT = 'LOYALINN_WEBHOOKSYNC_ENDPOINT';
    const CONF_TENANT_KEY = 'LOYALINN_WEBHOOKSYNC_TENANT_KEY';
    const CONF_SHARED_SECRET = 'LOYALINN_WEBHOOKSYNC_SHARED_SECRET';
    const CONF_TIMEOUT = 'LOYALINN_WEBHOOKSYNC_TIMEOUT';

    public function __construct()
    {
        $this->name = 'loyalinnwebhooksync';
        $this->tab = 'administration';
        $this->version = '0.1.0';
        $this->author = 'LoyalInn';
        $this->need_instance = 1;
        $this->bootstrap = true;
        parent::__construct();

        $this->displayName = $this->l('LoyalInn Webhook Sync');
        $this->description = $this->l('Sends signed booking lifecycle webhooks from QloApps to LoyalInn app.');
    }

    public function install()
    {
        return parent::install()
            && $this->registerHook('actionValidateOrder')
            && $this->registerHook('actionPaymentConfirmation')
            && $this->registerHook('actionOrderStatusUpdate')
            && $this->registerHook('actionOrderStatusPostUpdate')
            && $this->registerHook('actionRoomBookingStatusUpdateAfter')
            && Configuration::updateValue(self::CONF_ENABLED, 0)
            && Configuration::updateValue(self::CONF_ENDPOINT, '')
            && Configuration::updateValue(self::CONF_TENANT_KEY, '')
            && Configuration::updateValue(self::CONF_SHARED_SECRET, '')
            && Configuration::updateValue(self::CONF_TIMEOUT, 5);
    }

    public function uninstall()
    {
        return Configuration::deleteByName(self::CONF_ENABLED)
            && Configuration::deleteByName(self::CONF_ENDPOINT)
            && Configuration::deleteByName(self::CONF_TENANT_KEY)
            && Configuration::deleteByName(self::CONF_SHARED_SECRET)
            && Configuration::deleteByName(self::CONF_TIMEOUT)
            && parent::uninstall();
    }

    public function getContent()
    {
        $output = '';

        if (Tools::isSubmit('submitLoyalinnWebhookSync')) {
            $enabled = (int) Tools::getValue(self::CONF_ENABLED, 0);
            $endpoint = trim((string) Tools::getValue(self::CONF_ENDPOINT, ''));
            $tenantKey = trim((string) Tools::getValue(self::CONF_TENANT_KEY, ''));
            $sharedSecret = trim((string) Tools::getValue(self::CONF_SHARED_SECRET, ''));
            $timeout = (int) Tools::getValue(self::CONF_TIMEOUT, 5);

            Configuration::updateValue(self::CONF_ENABLED, $enabled);
            Configuration::updateValue(self::CONF_ENDPOINT, $endpoint);
            Configuration::updateValue(self::CONF_TENANT_KEY, $tenantKey);
            Configuration::updateValue(self::CONF_SHARED_SECRET, $sharedSecret);
            Configuration::updateValue(self::CONF_TIMEOUT, max(1, $timeout));

            $output .= $this->displayConfirmation($this->l('Settings updated.'));
        }

        if (Tools::isSubmit('submitLoyalinnWebhookSyncTest')) {
            $result = $this->dispatchEvent('booking.test', array(
                'id_order' => 0,
                'id_customer' => 0,
                'status_code' => null,
                'occurred_at' => gmdate('c'),
                'event_id' => 'manual-test-' . time(),
            ));

            if (!empty($result['ok'])) {
                $output .= $this->displayConfirmation($this->l('Test event sent successfully.'));
            } else {
                $output .= $this->displayError($this->l('Test event failed. Check module logs.'));
            }
        }

        $this->context->smarty->assign(array(
            'loyalinnWebhookDescriptionTemplate' => true,
        ));

        return $output . $this->renderConfigurationForm() . $this->display(__FILE__, 'views/templates/admin/configure.tpl');
    }

    protected function renderConfigurationForm()
    {
        $fieldsForm = array(
            'form' => array(
                'legend' => array(
                    'title' => $this->l('Webhook Settings'),
                    'icon' => 'icon-cogs',
                ),
                'input' => array(
                    array(
                        'type' => 'switch',
                        'label' => $this->l('Enabled'),
                        'name' => self::CONF_ENABLED,
                        'is_bool' => true,
                        'values' => array(
                            array('id' => 'active_on', 'value' => 1, 'label' => $this->l('Yes')),
                            array('id' => 'active_off', 'value' => 0, 'label' => $this->l('No')),
                        ),
                    ),
                    array(
                        'type' => 'text',
                        'label' => $this->l('Webhook Endpoint URL'),
                        'name' => self::CONF_ENDPOINT,
                        'required' => false,
                    ),
                    array(
                        'type' => 'text',
                        'label' => $this->l('Tenant Key (must match tenants.slug)'),
                        'name' => self::CONF_TENANT_KEY,
                        'required' => false,
                        'desc' => $this->l('Use the exact tenant slug from the app database, for example hotel-001.'),
                    ),
                    array(
                        'type' => 'password',
                        'label' => $this->l('Shared Secret'),
                        'name' => self::CONF_SHARED_SECRET,
                        'required' => false,
                    ),
                    array(
                        'type' => 'text',
                        'label' => $this->l('Request Timeout Seconds'),
                        'name' => self::CONF_TIMEOUT,
                        'required' => true,
                    ),
                ),
                'submit' => array(
                    'title' => $this->l('Save'),
                    'name' => 'submitLoyalinnWebhookSync',
                ),
                'buttons' => array(
                    array(
                        'title' => $this->l('Send Test Event'),
                        'name' => 'submitLoyalinnWebhookSyncTest',
                        'type' => 'submit',
                        'icon' => 'process-icon-save',
                    ),
                ),
            ),
        );

        $helper = new HelperForm();
        $helper->table = $this->table;
        $helper->name_controller = $this->name;
        $helper->token = Tools::getAdminTokenLite('AdminModules');
        $helper->currentIndex = AdminController::$currentIndex . '&configure=' . $this->name;
        $helper->submit_action = 'submitLoyalinnWebhookSync';
        $helper->fields_value = array(
            self::CONF_ENABLED => (int) Configuration::get(self::CONF_ENABLED),
            self::CONF_ENDPOINT => (string) Configuration::get(self::CONF_ENDPOINT),
            self::CONF_TENANT_KEY => (string) Configuration::get(self::CONF_TENANT_KEY),
            self::CONF_SHARED_SECRET => (string) Configuration::get(self::CONF_SHARED_SECRET),
            self::CONF_TIMEOUT => (int) Configuration::get(self::CONF_TIMEOUT),
        );

        return $helper->generateForm(array($fieldsForm));
    }

    public function hookActionValidateOrder($params)
    {
        LoyalinnWebhookLogger::write('info', 'Hook actionValidateOrder triggered', array(
            'enabled' => $this->isModuleEnabled(),
            'has_order' => isset($params['order']) && is_object($params['order']),
            'order_id' => isset($params['order']) && is_object($params['order']) && isset($params['order']->id) ? (int) $params['order']->id : null,
            'customer_id' => isset($params['customer']) && is_object($params['customer']) && isset($params['customer']->id) ? (int) $params['customer']->id : null,
            'order_status_code' => isset($params['orderStatus']) && is_object($params['orderStatus']) && isset($params['orderStatus']->id) ? (int) $params['orderStatus']->id : null,
        ));

        if (!$this->isModuleEnabled()) {
            return;
        }

        $order = isset($params['order']) ? $params['order'] : null;
        $customer = isset($params['customer']) ? $params['customer'] : null;
        $orderStatus = isset($params['orderStatus']) ? $params['orderStatus'] : null;

        $this->dispatchEvent('booking.created', array(
            'id_order' => is_object($order) && isset($order->id) ? (int) $order->id : null,
            'id_customer' => is_object($customer) && isset($customer->id) ? (int) $customer->id : null,
            'order_status_code' => is_object($orderStatus) && isset($orderStatus->id) ? (int) $orderStatus->id : null,
            'status_code' => is_object($orderStatus) && isset($orderStatus->id) ? (int) $orderStatus->id : null,
            'event_source_hook' => 'actionValidateOrder',
            'occurred_at' => gmdate('c'),
        ));
    }

    public function hookActionPaymentConfirmation($params)
    {
        LoyalinnWebhookLogger::write('info', 'Hook actionPaymentConfirmation triggered', array(
            'enabled' => $this->isModuleEnabled(),
            'id_order' => isset($params['id_order']) ? (int) $params['id_order'] : null,
        ));

        if (!$this->isModuleEnabled()) {
            return;
        }

        $idOrder = isset($params['id_order']) ? (int) $params['id_order'] : null;
        $order = $idOrder ? new Order($idOrder) : null;

        $this->dispatchEvent('booking.payment_confirmed', array(
            'id_order' => $idOrder,
            'id_customer' => Validate::isLoadedObject($order) ? (int) $order->id_customer : null,
            'order_status_code' => 2,
            'status_code' => 2,
            'event_source_hook' => 'actionPaymentConfirmation',
            'occurred_at' => gmdate('c'),
        ));
    }

    public function hookActionOrderStatusUpdate($params)
    {
        $this->handleOrderStatusHook('actionOrderStatusUpdate', $params, false);
    }

    public function hookActionOrderStatusPostUpdate($params)
    {
        $this->handleOrderStatusHook('actionOrderStatusPostUpdate', $params, true);
    }

    public function hookActionRoomBookingStatusUpdateAfter($params)
    {
        $idRoomBooking = isset($params['id_hotel_booking_detail']) ? (int) $params['id_hotel_booking_detail'] : null;
        $roomBooking = $this->loadRoomBooking($idRoomBooking);
        $idOrder = isset($params['id_order']) ? (int) $params['id_order'] : ($roomBooking && isset($roomBooking->id_order) ? (int) $roomBooking->id_order : null);
        $order = $idOrder ? new Order($idOrder) : null;

        LoyalinnWebhookLogger::write('info', 'Room booking status hook triggered', array(
            'hook' => 'actionRoomBookingStatusUpdateAfter',
            'enabled' => $this->isModuleEnabled(),
            'id_order' => $idOrder,
            'id_room_booking' => $idRoomBooking,
            'id_room' => isset($params['id_room']) ? (int) $params['id_room'] : ($roomBooking && isset($roomBooking->id_room) ? (int) $roomBooking->id_room : null),
            'room_status_code' => $roomBooking && isset($roomBooking->id_status) ? (int) $roomBooking->id_status : null,
            'check_in' => $roomBooking && isset($roomBooking->check_in) ? (string) $roomBooking->check_in : null,
            'check_out' => $roomBooking && isset($roomBooking->check_out) ? (string) $roomBooking->check_out : null,
        ));

        if (!$this->isModuleEnabled()) {
            return;
        }

        $this->dispatchEvent('booking.room_status_changed', array(
            'id_order' => $idOrder,
            'id_customer' => Validate::isLoadedObject($order) ? (int) $order->id_customer : null,
            'id_room_booking' => $idRoomBooking,
            'id_room' => isset($params['id_room']) ? (int) $params['id_room'] : ($roomBooking && isset($roomBooking->id_room) ? (int) $roomBooking->id_room : null),
            'id_product' => $roomBooking && isset($roomBooking->id_product) ? (int) $roomBooking->id_product : null,
            'room_number' => $roomBooking && isset($roomBooking->room_num) ? (string) $roomBooking->room_num : null,
            'room_status_code' => $roomBooking && isset($roomBooking->id_status) ? (int) $roomBooking->id_status : null,
            'check_in' => $roomBooking && isset($roomBooking->check_in) ? (string) $roomBooking->check_in : null,
            'check_out' => $roomBooking && isset($roomBooking->check_out) ? (string) $roomBooking->check_out : null,
            'date_from' => isset($params['date_from']) ? (string) $params['date_from'] : ($roomBooking && isset($roomBooking->date_from) ? (string) $roomBooking->date_from : null),
            'date_to' => isset($params['date_to']) ? (string) $params['date_to'] : ($roomBooking && isset($roomBooking->date_to) ? (string) $roomBooking->date_to : null),
            'event_source_hook' => 'actionRoomBookingStatusUpdateAfter',
            'occurred_at' => gmdate('c'),
        ));
    }

    protected function isModuleEnabled()
    {
        return (bool) Configuration::get(self::CONF_ENABLED);
    }

    protected function dispatchEvent($eventType, $payload)
    {
        $endpoint = (string) Configuration::get(self::CONF_ENDPOINT);
        $tenantKey = (string) Configuration::get(self::CONF_TENANT_KEY);
        $sharedSecret = (string) Configuration::get(self::CONF_SHARED_SECRET);
        $timeout = (int) Configuration::get(self::CONF_TIMEOUT);

        return LoyalinnWebhookClient::send(
            $endpoint,
            $tenantKey,
            $sharedSecret,
            $eventType,
            $payload,
            max(1, $timeout)
        );
    }

    protected function loadRoomBooking($idRoomBooking)
    {
        if (!$idRoomBooking || !class_exists('HotelBookingDetail')) {
            return null;
        }

        $roomBooking = new HotelBookingDetail((int) $idRoomBooking);
        return Validate::isLoadedObject($roomBooking) ? $roomBooking : null;
    }

    protected function handleOrderStatusHook($hookName, $params, $dispatch)
    {
        $idOrder = isset($params['id_order']) ? (int) $params['id_order'] : null;
        $newOrderStatus = isset($params['newOrderStatus']) ? $params['newOrderStatus'] : null;

        LoyalinnWebhookLogger::write('info', 'Order status hook triggered', array(
            'hook' => $hookName,
            'enabled' => $this->isModuleEnabled(),
            'dispatch' => $dispatch,
            'id_order' => $idOrder,
            'order_status_code' => is_object($newOrderStatus) && isset($newOrderStatus->id) ? (int) $newOrderStatus->id : null,
        ));

        if (!$this->isModuleEnabled() || !$dispatch) {
            return;
        }

        $order = $idOrder ? new Order($idOrder) : null;

        $this->dispatchEvent('booking.order_status_changed', array(
            'id_order' => $idOrder,
            'id_customer' => Validate::isLoadedObject($order) ? (int) $order->id_customer : null,
            'order_status_code' => is_object($newOrderStatus) && isset($newOrderStatus->id) ? (int) $newOrderStatus->id : null,
            'status_code' => is_object($newOrderStatus) && isset($newOrderStatus->id) ? (int) $newOrderStatus->id : null,
            'event_source_hook' => $hookName,
            'occurred_at' => gmdate('c'),
        ));
    }
}
