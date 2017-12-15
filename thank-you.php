<!doctype html>
<html lang="en">
  <head>
    <title>Заявка отправлена!</title>
    <!-- Required meta tags -->
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
        
    <!-- Fonts -->
    <link href="https://fonts.googleapis.com/css?family=PT+Sans" rel="stylesheet">

    <!-- Bootstrap CSS -->
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0-beta.2/css/bootstrap.min.css" integrity="sha384-PsH8R72JQ3SOdhVi3uxftmaW6Vc51MKb0q5P2rRUpPvrszuE4W1povHYgTpBfshb" crossorigin="anonymous">

    <link rel="shortcut icon" href="/imgs/fav.png" type="image/png">
    <link href="style.css" rel="stylesheet">
  </head>

<body>
<?php // require_once 'header.php'; ?>

<div class="container-fluid questions-wrapper">
    <div class="row">
        <div class="col-md-12">
            <div class="thank-you text-center" style="margin-top: 100px;">
                <span>Спасибо за обращение! С вами свяжутся в ближайшее время!</span><br>
                <span>Вернуться на <a href="/">Главную.</a></span>
            </div>
        </div>
    </div>
</div>

<?php //require_once 'footer.php'; ?>

<?php 

// print_r($_POST);

$headers = 'MIME-Version: 1.0' . "\r\n";
$headers .= 'Content-type: text/html; charset=utf-8' . "\r\n";
$to = 'domosed365365@gmail.com';
$subject = "Заявка с сайта smartfox (desktop)";


$message = '<html><head><title></title></head><body>
                    <strong>Тема: заявка с сайта smartfox (desktop)</strong><br><br><br>' .
                    '<b>Имя:</b> ' . $_POST['name'] . '<br><br>'           .
                    '<b>Телефон:</b> ' . $_POST['phone'] . '<br><br>'      .  
                    '<b>Email:</b> ' . $_POST['email'] . '<br><br>'        .
                    '<b>Сообщение:</b> ' . $_POST['question'] . '<br><br>' .
                    '<b>Тариф:</b> ' . $_POST['tariff']                    .
                    '</body></html>';

mail($to, $subject, $message, $headers);
exit();


?>


